use std::ops::Deref;

use anyhow::Result;
use hashbrown::HashMap;
use ratatui::style::Color;
use serde::{Deserialize, Deserializer};
use yazi_codegen::DeserializeOver2;
use yazi_fs::File;
use yazi_shared::{Condition, url::UrlLike};

use crate::{Icon as I, Pattern, Style};

#[derive(Default, Deserialize, DeserializeOver2)]
pub struct Icon {
	globs:         PatIcons,
	#[serde(default)]
	prepend_globs: PatIcons,
	#[serde(default)]
	append_globs:  PatIcons,

	dirs:         StrIcons,
	#[serde(default)]
	prepend_dirs: StrIcons,
	#[serde(default)]
	append_dirs:  StrIcons,

	files:         StrIcons,
	#[serde(default)]
	prepend_files: StrIcons,
	#[serde(default)]
	append_files:  StrIcons,

	exts:         StrIcons,
	#[serde(default)]
	prepend_exts: StrIcons,
	#[serde(default)]
	append_exts:  StrIcons,

	conds:         CondIcons,
	#[serde(default)]
	prepend_conds: CondIcons,
	#[serde(default)]
	append_conds:  CondIcons,
}

impl Icon {
	pub fn matches(&self, file: &File, hovered: bool) -> Option<&I> {
		if let Some(i) = self.match_by_glob(file) {
			return Some(i);
		}

		if let Some(i) = self.match_by_name(file) {
			return Some(i);
		}

		let f = |s: &str| match s {
			"dir" => file.is_dir(),
			"hidden" => file.is_hidden(),
			"link" => file.is_link(),
			"orphan" => file.is_orphan(),
			"dummy" => file.is_dummy(),
			"block" => file.is_block(),
			"char" => file.is_char(),
			"fifo" => file.is_fifo(),
			"sock" => file.is_sock(),
			"exec" => file.is_exec(),
			"sticky" => file.is_sticky(),
			"hovered" => hovered,
			_ => false,
		};
		self.conds.iter().find(|(c, _)| c.eval(f) == Some(true)).map(|(_, i)| i)
	}

	fn match_by_glob(&self, file: &File) -> Option<&I> {
		self.globs.iter().find(|(p, _)| p.match_url(&file.url, file.is_dir())).map(|(_, i)| i)
	}

	fn match_by_name(&self, file: &File) -> Option<&I> {
		let name = file.name()?.to_str().ok()?;
		if file.is_dir() {
			get_ascii_ci(&self.dirs, name)
		} else {
			get_ascii_ci(&self.files, name).or_else(|| self.match_by_ext(file))
		}
	}

	fn match_by_ext(&self, file: &File) -> Option<&I> {
		let ext = file.url.ext()?.to_str().ok()?;
		get_ascii_ci(&self.exts, ext)
	}
}

#[inline]
fn get_ascii_ci<'a>(icons: &'a StrIcons, key: &str) -> Option<&'a I> {
	icons.get(key).or_else(|| {
		key.bytes()
			.any(|b| b.is_ascii_uppercase())
			.then(|| key.to_ascii_lowercase())
			.and_then(|lower| icons.get(lower.as_str()))
	})
}

impl Icon {
	pub(crate) fn reshape(self) -> Result<Self> {
		Ok(Self {
			globs: PatIcons(
				self.prepend_globs.0.into_iter().chain(self.globs.0).chain(self.append_globs.0).collect(),
			),
			dirs: StrIcons(
				self.append_dirs.0.into_iter().chain(self.dirs.0).chain(self.prepend_dirs.0).collect(),
			),
			files: StrIcons(
				self.append_files.0.into_iter().chain(self.files.0).chain(self.prepend_files.0).collect(),
			),
			exts: StrIcons(
				self.append_exts.0.into_iter().chain(self.exts.0).chain(self.prepend_exts.0).collect(),
			),
			conds: CondIcons(
				self.prepend_conds.0.into_iter().chain(self.conds.0).chain(self.append_conds.0).collect(),
			),
			..Default::default()
		})
	}
}

#[derive(Default)]
pub struct PatIcons(Vec<(Pattern, I)>);

impl Deref for PatIcons {
	type Target = Vec<(Pattern, I)>;

	fn deref(&self) -> &Self::Target { &self.0 }
}

impl<'de> Deserialize<'de> for PatIcons {
	fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
	where
		D: Deserializer<'de>,
	{
		#[derive(Deserialize)]
		struct Shadow {
			url:  Pattern,
			text: String,
			fg:   Option<Color>,
		}

		Ok(Self(
			<Vec<Shadow>>::deserialize(deserializer)?
				.into_iter()
				.map(|s| (s.url, I { text: s.text, style: Style { fg: s.fg, ..Default::default() } }))
				.collect(),
		))
	}
}

#[derive(Default)]
pub struct StrIcons(HashMap<String, I>);

impl Deref for StrIcons {
	type Target = HashMap<String, I>;

	fn deref(&self) -> &Self::Target { &self.0 }
}

impl<'de> Deserialize<'de> for StrIcons {
	fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
	where
		D: Deserializer<'de>,
	{
		#[derive(Deserialize)]
		struct Shadow {
			name: String,
			text: String,
			fg:   Option<Color>,
		}

		Ok(Self(
			<Vec<Shadow>>::deserialize(deserializer)?
				.into_iter()
				.map(|s| (s.name, I { text: s.text, style: Style { fg: s.fg, ..Default::default() } }))
				.collect(),
		))
	}
}

#[derive(Default)]
pub struct CondIcons(Vec<(Condition, I)>);

impl Deref for CondIcons {
	type Target = Vec<(Condition, I)>;

	fn deref(&self) -> &Self::Target { &self.0 }
}

impl<'de> Deserialize<'de> for CondIcons {
	fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
	where
		D: Deserializer<'de>,
	{
		#[derive(Deserialize)]
		struct Shadow {
			r#if: Condition,
			text: String,
			fg:   Option<Color>,
		}

		Ok(Self(
			<Vec<Shadow>>::deserialize(deserializer)?
				.into_iter()
				.map(|s| (s.r#if, I { text: s.text, style: Style { fg: s.fg, ..Default::default() } }))
				.collect(),
		))
	}
}

#[cfg(test)]
mod tests {
	use super::{I, StrIcons, Style, get_ascii_ci};
	use hashbrown::HashMap;

	#[test]
	fn reuses_exact_match_without_fallback_allocation() {
		let icons = StrIcons(HashMap::from([(String::from("README.md"), I {
			text: String::from("x"),
			style: Style::default(),
		})]));

		assert_eq!(get_ascii_ci(&icons, "README.md").map(|i| i.text.as_str()), Some("x"));
	}

	#[test]
	fn matches_lowercase_fallback_for_ascii_keys() {
		let icons = StrIcons(HashMap::from([(String::from("readme.md"), I {
			text: String::from("x"),
			style: Style::default(),
		})]));

		assert_eq!(get_ascii_ci(&icons, "README.MD").map(|i| i.text.as_str()), Some("x"));
	}
}
