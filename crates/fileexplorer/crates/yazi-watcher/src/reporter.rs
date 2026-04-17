use std::borrow::Cow;

use percent_encoding::percent_decode;
use tokio::sync::mpsc;
use yazi_shared::{scheme::SchemeKind, url::{AsUrl, Url, UrlBuf, UrlCow, UrlLike}};

use crate::{WATCHED, local::LINKED};

#[derive(Clone)]
pub(crate) struct Reporter {
	pub(super) local_tx:  mpsc::UnboundedSender<UrlBuf>,
	pub(super) remote_tx: mpsc::UnboundedSender<(UrlBuf, bool)>,
}

impl Reporter {
	pub(crate) fn report<'a, I>(&self, urls: I)
	where
		I: IntoIterator,
		I::Item: Into<UrlCow<'a>>,
	{
		for url in urls.into_iter().map(Into::into) {
			match url.as_url().kind() {
				SchemeKind::Regular | SchemeKind::Search => self.report_local(url),
				SchemeKind::Archive => {}
				SchemeKind::Sftp => self.report_remote(url),
			}
		}
	}

	fn report_local(&self, url: UrlCow) {
		let Some((parent, urn)) = url.pair() else { return };

		// FIXME: LINKED should return Url instead of Path
		let linked = LINKED.read();
		let linked = linked.from_dir(parent).map(Url::regular);

		let watched = WATCHED.read();
		for parent in [parent].into_iter().chain(linked) {
			if watched.contains_url(parent) {
				self.local_tx.send(url.to_owned()).ok();
				self.local_tx.send(parent.to_owned()).ok();
			}

			if urn.ext().is_some_and(|e| e == "%tmp") {
				continue;
			}

			// Virtual caches
			let Some(dir) = watched.find_by_cache(parent.loc()) else { continue };
			let Some(name) = url.name() else { continue };
			if let Ok(u) = dir.try_join(Cow::from(percent_decode(name.encoded_bytes()))) {
				self.remote_tx.send((u, true)).ok();
			}
			self.remote_tx.send((dir, false)).ok();
		}
	}

	fn report_remote(&self, url: UrlCow) {
		let Some(parent) = url.parent() else { return };
		if !WATCHED.read().contains_url(parent) {
			return;
		}

		self.remote_tx.send((parent.to_owned(), false)).ok();
		self.remote_tx.send((url.into_owned(), false)).ok();
	}
}

#[cfg(test)]
mod tests {
	use tokio::sync::mpsc;
	use yazi_shared::url::UrlBuf;

	use super::*;
	use crate::Watchee;

	fn init_watcher_tests() -> std::sync::MutexGuard<'static, ()> {
		let guard = crate::lock_test_runtime();
		WATCHED.write().clear();
		LINKED.write().clear();
		guard
	}

	#[tokio::test]
	async fn report_remote_emits_parent_and_child_for_watched_roots() {
		let _guard = init_watcher_tests();

		let parent: UrlBuf = "sftp://demo//vault".parse().expect("valid parent url");
		let child: UrlBuf = "sftp://demo:2:1//vault/file.txt".parse().expect("valid child url");
		WATCHED.write().insert(Watchee::new(parent.clone()).await.to_static());

		let (_local_tx, mut local_rx) = mpsc::unbounded_channel();
		let (remote_tx, mut remote_rx) = mpsc::unbounded_channel();
		let reporter = Reporter { local_tx: _local_tx, remote_tx };

		reporter.report([child.clone()]);

		assert_eq!(remote_rx.recv().await, Some((parent.clone(), false)));
		assert_eq!(remote_rx.recv().await, Some((child, false)));
		assert!(remote_rx.try_recv().is_err());
		assert!(local_rx.try_recv().is_err());
	}

	#[tokio::test]
	async fn report_remote_ignores_unwatched_roots() {
		let _guard = init_watcher_tests();

		let child: UrlBuf = "sftp://demo:2:1//vault/file.txt".parse().expect("valid child url");
		let (_local_tx, mut local_rx) = mpsc::unbounded_channel();
		let (remote_tx, mut remote_rx) = mpsc::unbounded_channel();
		let reporter = Reporter { local_tx: _local_tx, remote_tx };

		reporter.report([child]);

		assert!(remote_rx.try_recv().is_err());
		assert!(local_rx.try_recv().is_err());
	}
}
