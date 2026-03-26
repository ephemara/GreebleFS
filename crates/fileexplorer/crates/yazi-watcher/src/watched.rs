use std::{ops::{Deref, DerefMut}, path::Path};

use hashbrown::HashSet;
use percent_encoding::percent_decode_str;
use yazi_fs::{Xdg, path::PercentEncoding};
use yazi_shared::{path::{Component, PathBufDyn, PathDyn, PathLike}, pool::InternStr, scheme::SchemeKind, url::{AsUrl, UrlBuf}};

use crate::Watchee;

#[derive(Debug, Default)]
pub struct Watched(HashSet<Watchee<'static>>);

impl Deref for Watched {
	type Target = HashSet<Watchee<'static>>;

	fn deref(&self) -> &Self::Target { &self.0 }
}

impl DerefMut for Watched {
	fn deref_mut(&mut self) -> &mut Self::Target { &mut self.0 }
}

impl Watched {
	pub(super) fn contains_url(&self, url: impl AsUrl) -> bool {
		let url = url.as_url();
		if url.as_local().is_some() {
			self.0.contains(&Watchee::Local(url.into(), false))
				|| self.0.contains(&Watchee::Local(url.into(), true))
		} else {
			self.0.contains(&Watchee::Remote(url.into()))
		}
	}

	pub(super) fn contains_path(&self, path: &Path) -> bool {
		self.0.iter().any(|watchee| watchee.as_url().as_local() == Some(path))
	}

	pub(super) fn paths(&self) -> impl Iterator<Item = &Path> {
		self.0.iter().filter_map(|watchee| watchee.as_url().as_local())
	}

	pub(super) fn find_by_cache(&self, cache: PathDyn) -> Option<UrlBuf> {
		let mut it = cache.try_strip_prefix(Xdg::cache_dir()).ok()?.components();

		// Parse domain
		let domain = it.next()?.as_normal()?.to_str().ok()?;
		let domain = percent_decode_str(domain.strip_prefix("sftp-")?).decode_utf8().ok()?.intern();

		// Parse path
		let (path, abs) =
			if let Ok(p) = it.path().try_strip_prefix(".%2F") { (p, false) } else { (it.path(), true) };
		let path = path.percent_decode(SchemeKind::Sftp).ok()?;
		let path = PathBufDyn::from_components(
			SchemeKind::Sftp,
			Some(Component::RootDir).filter(|_| abs).into_iter().chain(path.components()),
		)
		.ok()?;

		let url = UrlBuf::Sftp { loc: path.into_unix().ok()?.into(), domain };
		if self.contains_url(&url) { Some(url) } else { None }
	}
}

#[cfg(test)]
mod tests {
	use std::sync::OnceLock;

	use super::*;
	use yazi_shared::url::UrlBuf;

	fn init_watcher_tests() {
		static INIT: OnceLock<()> = OnceLock::new();

		yazi_shared::init_tests();
		INIT.get_or_init(crate::init);
	}

	#[tokio::test]
	async fn contains_url_matches_primary_and_alt_local_watchers() {
		init_watcher_tests();

		let path = std::env::temp_dir().join("yazi-watcher-watched-primary");
		let mut watched = Watched::default();
		watched.insert(Watchee::new(path.as_path()).await.to_static());

		assert!(watched.contains_url(path.as_path()));
		assert!(watched.contains_path(path.as_path()));

		let mut alt_watched = Watched::default();
		alt_watched.insert(Watchee::Local(UrlBuf::from(path.as_path()).into(), true));

		assert!(alt_watched.contains_url(path.as_path()));
		assert!(alt_watched.contains_path(path.as_path()));
	}

	#[test]
	fn find_by_cache_decodes_sftp_cache_paths_for_watched_roots() {
		init_watcher_tests();

		let mut watched = Watched::default();
		let remote: UrlBuf = "sftp://demo//vault".parse().expect("valid remote url");
		watched.insert(Watchee::Remote(remote.clone().into()));

		let cache = Xdg::cache_dir().join("sftp-demo").join(".%2Fvault");
		assert_eq!(watched.find_by_cache(cache.as_path()), Some(remote));

		let other_cache = Xdg::cache_dir().join("sftp-demo").join(".%2Fother");
		assert_eq!(watched.find_by_cache(other_cache.as_path()), None);
	}
}
