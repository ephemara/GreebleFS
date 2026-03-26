use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::quote;
use syn::{Data, DeriveInput, Fields, Generics, Ident, parse_macro_input};

#[proc_macro_derive(DeserializeOver)]
pub fn deserialize_over(input: TokenStream) -> TokenStream {
	let DeriveInput { ident, .. } = parse_macro_input!(input as DeriveInput);

	deserialize_over_impl(&ident).into()
}

#[proc_macro_derive(DeserializeOver1)]
pub fn deserialize_over1(input: TokenStream) -> TokenStream {
	let DeriveInput { ident, data, .. } = parse_macro_input!(input as DeriveInput);

	deserialize_over1_impl(&ident, data).into()
}

#[proc_macro_derive(DeserializeOver2)]
pub fn deserialize_over2(input: TokenStream) -> TokenStream {
	let DeriveInput { ident, data, .. } = parse_macro_input!(input as DeriveInput);

	deserialize_over2_impl(&ident, data).into()
}

#[proc_macro_derive(FromLuaOwned)]
pub fn from_lua(input: TokenStream) -> TokenStream {
	let DeriveInput { ident, generics, .. } = parse_macro_input!(input as DeriveInput);

	from_lua_impl(&ident, &generics).into()
}

fn deserialize_over_impl(ident: &Ident) -> TokenStream2 {
	quote! {
		impl #ident {
			pub(crate) fn deserialize_over(self, input: &str) -> Result<Self, toml::de::Error> {
				crate::error_with_input(self.deserialize_over_with(toml::de::DeTable::parse(input)?), input)
			}
		}
	}
}

fn deserialize_over1_impl(ident: &Ident, data: Data) -> TokenStream2 {
	let assignments = match data {
		Data::Struct(struct_) => match struct_.fields {
			Fields::Named(fields) => {
				let mut assignments = Vec::with_capacity(fields.named.len());

				for field in fields.named {
					let field_ident = &field.ident;
					let field_name = field_ident.as_ref().unwrap().to_string();

					assignments.push(quote! {
						if let Some(value) = table.remove(#field_name) {
							if !matches!(value.get_ref(), toml::de::DeValue::Table(_)) {
								_ = toml::Table::deserialize(value.into_deserializer())?;
								return Err(serde::de::Error::custom(format!("expected top-level `{}` to be a TOML table", #field_name)));
							}

							let span = value.span();
							if let toml::de::DeValue::Table(table) = value.into_inner() {
								self.#field_ident = self.#field_ident.deserialize_over_with(toml::Spanned::new(span, table))?;
							}
						}
					});
				}

				assignments
			}
			_ => panic!("DeserializeOver1 only supports structs with named fields"),
		},
		_ => panic!("DeserializeOver1 only supports structs"),
	};

	quote! {
		impl #ident {
			pub(crate) fn deserialize_over_with<'de>(mut self, table: toml::Spanned<toml::de::DeTable<'de>>) -> Result<Self, toml::de::Error> {
				use serde::{Deserialize, de::IntoDeserializer};

				let mut table = table.into_inner();
				#(#assignments)*

				Ok(self)
			}
		}
	}
}

fn deserialize_over2_impl(ident: &Ident, data: Data) -> TokenStream2 {
	let assignments = match data {
		Data::Struct(struct_) => match struct_.fields {
			Fields::Named(fields) => {
				let mut assignments = Vec::with_capacity(fields.named.len());

				for field in fields.named {
					let field_ident = field.ident;
					let field_name = field_ident.as_ref().unwrap().to_string();

					assignments.push(quote! {
						if let Some(value) = table.remove(#field_name) {
							self.#field_ident = <_>::deserialize(value.into_deserializer())?;
						}
					});
				}

				assignments
			}
			_ => panic!("DeserializeOver2 only supports structs with named fields"),
		},
		_ => panic!("DeserializeOver2 only supports structs"),
	};

	quote! {
		impl #ident {
			pub(crate) fn deserialize_over_with<'de>(mut self, table: toml::Spanned<toml::de::DeTable<'de>>) -> Result<Self, toml::de::Error> {
				use serde::{Deserialize, de::IntoDeserializer};

				let mut table = table.into_inner();
				#(#assignments)*

				Ok(self)
			}
		}
	}
}

fn from_lua_impl(ident: &Ident, generics: &Generics) -> TokenStream2 {
	let ident_str = ident.to_string();
	let (impl_generics, ty_generics, where_clause) = generics.split_for_impl();

	quote! {
		impl #impl_generics ::mlua::FromLua for #ident #ty_generics #where_clause {
			#[inline]
			fn from_lua(value: ::mlua::Value, _: &::mlua::Lua) -> ::mlua::Result<Self> {
				match value {
					::mlua::Value::UserData(ud) => ud.take::<Self>(),
					_ => Err(::mlua::Error::FromLuaConversionError {
						from: value.type_name(),
						to: #ident_str.to_owned(),
						message: None,
					}),
				}
			}
		}
	}
}

#[cfg(test)]
mod tests {
	use syn::parse_quote;

	use super::{deserialize_over_impl, deserialize_over1_impl, deserialize_over2_impl, from_lua_impl};

	#[test]
	fn deserialize_over_wraps_table_parse_with_error_context() {
		let tokens = deserialize_over_impl(&parse_quote!(Outer)).to_string();

		assert!(tokens.contains("DeTable :: parse"));
		assert!(tokens.contains("crate :: error_with_input"));
		assert!(tokens.contains("deserialize_over_with"));
	}

	#[test]
	fn deserialize_over1_generates_nested_table_merge_and_type_guard() {
		let input: syn::DeriveInput = parse_quote! {
			struct Outer {
				alpha: Alpha,
				beta: Beta,
			}
		};

		let tokens = deserialize_over1_impl(&input.ident, input.data).to_string();

		assert!(tokens.contains("expected top-level"));
		assert!(tokens.contains("alpha"));
		assert!(tokens.contains("beta"));
		assert!(tokens.contains("TOML table"));
		assert!(tokens.contains("self . alpha = self . alpha . deserialize_over_with"));
		assert!(tokens.contains("self . beta = self . beta . deserialize_over_with"));
		assert!(tokens.contains("toml :: Spanned :: new"));
	}

	#[test]
	fn deserialize_over2_generates_direct_field_replacement() {
		let input: syn::DeriveInput = parse_quote! {
			struct Outer {
				alpha: String,
				beta: usize,
			}
		};

		let tokens = deserialize_over2_impl(&input.ident, input.data).to_string();

		assert!(tokens.contains("if let Some (value) = table . remove (\"alpha\")"));
		assert!(tokens.contains("if let Some (value) = table . remove (\"beta\")"));
		assert!(tokens.contains("self . alpha = < _ > :: deserialize"));
		assert!(tokens.contains("self . beta = < _ > :: deserialize"));
	}

	#[test]
	fn from_lua_owned_preserves_generics_and_userdata_take_path() {
		let input: syn::DeriveInput = parse_quote! {
			struct Payload<T: Clone>(T)
			where
				T: Send;
		};

		let tokens = from_lua_impl(&input.ident, &input.generics).to_string();

		assert!(tokens.contains("impl < T : Clone > :: mlua :: FromLua for Payload < T > where T : Send"));
		assert!(tokens.contains(":: mlua :: Value :: UserData (ud) => ud . take :: < Self > ()"));
		assert!(tokens.contains("to : \"Payload\" . to_owned ()"));
	}
}
