use std::ops::Deref;

use mlua::{AnyUserData, ExternalError, FromLua, Lua, ObjectLike, Table, UserData, UserDataFields, UserDataMethods, UserDataRef, Value};

use crate::{Cha, Url, impl_file_fields, impl_file_methods};

pub type FileRef = UserDataRef<File>;

const EXPECTED: &str = "expected a table, File, or fs::File";

#[derive(Clone)]
pub struct File {
	inner: yazi_fs::File,

	v_cha:     Option<Value>,
	v_url:     Option<Value>,
	v_link_to: Option<Value>,

	v_name:  Option<Value>,
	v_path:  Option<Value>,
	v_cache: Option<Value>,
	v_icon:  Option<Value>,
}

impl Deref for File {
	type Target = yazi_fs::File;

	fn deref(&self) -> &Self::Target { &self.inner }
}

impl From<File> for yazi_fs::File {
	fn from(value: File) -> Self { value.inner }
}

impl File {
	pub fn new(inner: impl Into<yazi_fs::File>) -> Self {
		Self {
			inner:     inner.into(),
			v_cha:     None,
			v_url:     None,
			v_link_to: None,

			v_name:  None,
			v_path:  None,
			v_cache: None,
			v_icon:  None,
		}
	}

	pub fn install(lua: &Lua) -> mlua::Result<()> {
		lua.globals().raw_set("File", lua.create_function(|_, file: Self| Ok(file))?)
	}
}

impl TryFrom<Table> for File {
	type Error = mlua::Error;

	fn try_from(value: Table) -> Result<Self, Self::Error> {
		Ok(Self::new(yazi_fs::File {
			url: value.raw_get::<Url>("url")?.into(),
			cha: *value.raw_get::<Cha>("cha")?,
			..Default::default()
		}))
	}
}

impl TryFrom<AnyUserData> for File {
	type Error = mlua::Error;

	fn try_from(value: AnyUserData) -> Result<Self, Self::Error> {
		Ok(if let Ok(me) = value.take::<Self>() { me } else { value.get("bare")? })
	}
}

impl FromLua for File {
	fn from_lua(value: Value, _: &Lua) -> mlua::Result<Self> {
		match value {
			Value::Table(tbl) => Self::try_from(tbl),
			Value::UserData(ud) => Self::try_from(ud),
			_ => Err(EXPECTED.into_lua_err())?,
		}
	}
}

impl UserData for File {
	fn add_fields<F: UserDataFields<Self>>(fields: &mut F) {
		impl_file_fields!(fields);
	}

	fn add_methods<M: UserDataMethods<Self>>(methods: &mut M) {
		impl_file_methods!(methods);

		methods.add_method_mut("icon", |lua, me, ()| {
			use crate::Icon;
			if let Some(icon) = &me.v_icon {
				return Ok(icon.clone());
			}

			let icon = match yazi_config::THEME.icon.matches(me, false) {
				Some(icon) => Value::UserData(lua.create_userdata(Icon::from(icon))?),
				None => Value::Nil,
			};
			me.v_icon = Some(icon.clone());
			Ok(icon)
		});
	}
}
