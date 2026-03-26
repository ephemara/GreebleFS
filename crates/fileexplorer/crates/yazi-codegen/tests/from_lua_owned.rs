use mlua::{Error, FromLua, Lua, UserData, Value};
use yazi_codegen::FromLuaOwned;

#[derive(Debug, Eq, PartialEq, FromLuaOwned)]
struct OwnedToken {
	name: String,
}

impl UserData for OwnedToken {}

#[derive(Debug, Eq, PartialEq, FromLuaOwned)]
struct GenericToken<T: Send + 'static>(T);

impl<T: Send + 'static> UserData for GenericToken<T> {}

#[test]
fn extracts_owned_userdata() {
	let lua = Lua::new();
	let value = lua
		.create_userdata(OwnedToken { name: "watcher".to_owned() })
		.expect("owned userdata should be created");

	let parsed = OwnedToken::from_lua(Value::UserData(value), &lua)
		.expect("owned userdata should deserialize");

	assert_eq!(parsed, OwnedToken { name: "watcher".to_owned() });
}

#[test]
fn extracts_generic_owned_userdata() {
	let lua = Lua::new();
	let value = lua
		.create_userdata(GenericToken("scheduler".to_owned()))
		.expect("generic userdata should be created");

	let parsed = GenericToken::<String>::from_lua(Value::UserData(value), &lua)
		.expect("generic owned userdata should deserialize");

	assert_eq!(parsed, GenericToken("scheduler".to_owned()));
}

#[test]
fn rejects_non_userdata_inputs_with_type_name() {
	let lua = Lua::new();
	let error = OwnedToken::from_lua(Value::Nil, &lua).expect_err("nil must be rejected");

	match error {
		Error::FromLuaConversionError { from, to, message } => {
			assert_eq!(from, "nil");
			assert_eq!(to, "OwnedToken");
			assert_eq!(message, None);
		}
		other => panic!("unexpected error: {other:?}"),
	}
}
