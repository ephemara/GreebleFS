use tauri::{
    menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Wry,
};

#[cfg(not(test))]
use crate::window_commands::{MAIN_TRAY_ICON_ID, MAIN_WINDOW_LABEL};

#[cfg(test)]
const MAIN_TRAY_ICON_ID: &str = "main-tray";
#[cfg(test)]
const MAIN_WINDOW_LABEL: &str = "main";

const OVERLAY_TOGGLE_REQUEST_EVENT: &str = "overlay://toggle-request";
const MAIN_TRAY_TOGGLE_MENU_ID: &str = "tray.window.toggle";
const MAIN_TRAY_QUIT_MENU_ID: &str = "tray.app.quit";

type SystemTrayMenuActionHandler = fn(&AppHandle<Wry>);

#[derive(Clone, Copy)]
pub struct SystemTrayDefinition {
    pub tooltip: &'static str,
    pub show_menu_on_left_click: bool,
    pub left_click_action: SystemTrayMenuActionHandler,
    pub items: &'static [SystemTrayMenuItemDefinition],
}

#[derive(Clone, Copy)]
pub enum SystemTrayMenuItemDefinition {
    Action(SystemTrayActionItemDefinition),
    CheckAction(SystemTrayCheckActionItemDefinition),
    Separator,
    Submenu(SystemTraySubmenuDefinition),
}

#[derive(Clone, Copy)]
pub struct SystemTrayActionItemDefinition {
    pub id: &'static str,
    pub label: &'static str,
    pub enabled: bool,
    pub on_activate: SystemTrayMenuActionHandler,
}

#[derive(Clone, Copy)]
pub struct SystemTrayCheckActionItemDefinition {
    pub id: &'static str,
    pub label: &'static str,
    pub enabled: bool,
    pub checked: bool,
    pub on_activate: SystemTrayMenuActionHandler,
}

#[derive(Clone, Copy)]
pub struct SystemTraySubmenuDefinition {
    pub id: &'static str,
    pub label: &'static str,
    pub enabled: bool,
    pub items: &'static [SystemTrayMenuItemDefinition],
}

const MAIN_SYSTEM_TRAY_MENU_ITEMS: &[SystemTrayMenuItemDefinition] = &[
    SystemTrayMenuItemDefinition::Action(SystemTrayActionItemDefinition {
        id: MAIN_TRAY_TOGGLE_MENU_ID,
        label: "Toggle GreebleFS",
        enabled: true,
        on_activate: toggle_main_window_from_tray,
    }),
    SystemTrayMenuItemDefinition::Separator,
    SystemTrayMenuItemDefinition::Action(SystemTrayActionItemDefinition {
        id: MAIN_TRAY_QUIT_MENU_ID,
        label: "Quit GreebleFS",
        enabled: true,
        on_activate: quit_application_from_tray,
    }),
];

pub const MAIN_SYSTEM_TRAY_DEFINITION: SystemTrayDefinition = SystemTrayDefinition {
    tooltip: "GreebleFS",
    show_menu_on_left_click: false,
    left_click_action: toggle_main_window_from_tray,
    items: MAIN_SYSTEM_TRAY_MENU_ITEMS,
};

pub fn build_main_system_tray(app_handle: &AppHandle<Wry>) -> tauri::Result<()> {
    let menu = build_menu_from_definitions(app_handle, MAIN_SYSTEM_TRAY_DEFINITION.items)?;
    let mut tray_builder = TrayIconBuilder::with_id(MAIN_TRAY_ICON_ID)
        .menu(&menu)
        .tooltip(MAIN_SYSTEM_TRAY_DEFINITION.tooltip)
        .show_menu_on_left_click(MAIN_SYSTEM_TRAY_DEFINITION.show_menu_on_left_click)
        .on_menu_event(|app, event| {
            dispatch_system_tray_menu_event(app, event.id.as_ref(), MAIN_SYSTEM_TRAY_DEFINITION.items);
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                (MAIN_SYSTEM_TRAY_DEFINITION.left_click_action)(tray.app_handle());
            }
        });

    if let Some(icon) = app_handle.default_window_icon().cloned() {
        tray_builder = tray_builder.icon(icon);
    }

    tray_builder.build(app_handle)?;
    Ok(())
}

fn build_menu_from_definitions(
    app_handle: &AppHandle<Wry>,
    menu_items: &'static [SystemTrayMenuItemDefinition],
) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app_handle)?;
    append_menu_items(app_handle, &menu, menu_items)?;
    Ok(menu)
}

fn append_menu_items(
    app_handle: &AppHandle<Wry>,
    target_menu: &impl SystemTrayAppendTarget,
    menu_items: &'static [SystemTrayMenuItemDefinition],
) -> tauri::Result<()> {
    for menu_item in menu_items {
        match menu_item {
            SystemTrayMenuItemDefinition::Action(definition) => {
                let menu_item = MenuItem::with_id(
                    app_handle,
                    definition.id,
                    definition.label,
                    definition.enabled,
                    None::<&str>,
                )?;
                target_menu.append_system_tray_item(&menu_item)?;
            }
            SystemTrayMenuItemDefinition::CheckAction(definition) => {
                let menu_item = CheckMenuItem::with_id(
                    app_handle,
                    definition.id,
                    definition.label,
                    definition.enabled,
                    definition.checked,
                    None::<&str>,
                )?;
                target_menu.append_system_tray_item(&menu_item)?;
            }
            SystemTrayMenuItemDefinition::Separator => {
                let separator = PredefinedMenuItem::separator(app_handle)?;
                target_menu.append_system_tray_item(&separator)?;
            }
            SystemTrayMenuItemDefinition::Submenu(definition) => {
                let submenu =
                    Submenu::with_id(app_handle, definition.id, definition.label, definition.enabled)?;
                append_menu_items(app_handle, &submenu, definition.items)?;
                target_menu.append_system_tray_item(&submenu)?;
            }
        }
    }

    Ok(())
}

fn dispatch_system_tray_menu_event(
    app_handle: &AppHandle<Wry>,
    menu_id: &str,
    menu_items: &'static [SystemTrayMenuItemDefinition],
) {
    if let Some(menu_action_handler) = resolve_menu_action_handler(menu_id, menu_items) {
        menu_action_handler(app_handle);
    }
}

fn resolve_menu_action_handler(
    menu_id: &str,
    menu_items: &'static [SystemTrayMenuItemDefinition],
) -> Option<SystemTrayMenuActionHandler> {
    for menu_item in menu_items {
        match menu_item {
            SystemTrayMenuItemDefinition::Action(definition) if definition.id == menu_id => {
                return Some(definition.on_activate);
            }
            SystemTrayMenuItemDefinition::CheckAction(definition) if definition.id == menu_id => {
                return Some(definition.on_activate);
            }
            SystemTrayMenuItemDefinition::Submenu(definition) => {
                if let Some(handler) = resolve_menu_action_handler(menu_id, definition.items) {
                    return Some(handler);
                }
            }
            _ => {}
        }
    }

    None
}

fn toggle_main_window_from_tray(app_handle: &AppHandle<Wry>) {
    if let Some(main_window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = main_window.emit(OVERLAY_TOGGLE_REQUEST_EVENT, ());
    }
}

fn quit_application_from_tray(app_handle: &AppHandle<Wry>) {
    app_handle.exit(0);
}

trait SystemTrayAppendTarget {
    fn append_system_tray_item(&self, menu_item: &dyn IsMenuItem<Wry>) -> tauri::Result<()>;
}

impl SystemTrayAppendTarget for Menu<Wry> {
    fn append_system_tray_item(&self, menu_item: &dyn IsMenuItem<Wry>) -> tauri::Result<()> {
        self.append(menu_item)
    }
}

impl SystemTrayAppendTarget for Submenu<Wry> {
    fn append_system_tray_item(&self, menu_item: &dyn IsMenuItem<Wry>) -> tauri::Result<()> {
        self.append(menu_item)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;

    const TEST_SUBMENU_ITEMS: &[SystemTrayMenuItemDefinition] = &[
        SystemTrayMenuItemDefinition::Action(SystemTrayActionItemDefinition {
            id: "tray.test.child-action",
            label: "Child Action",
            enabled: true,
            on_activate: noop_tray_action,
        }),
        SystemTrayMenuItemDefinition::CheckAction(SystemTrayCheckActionItemDefinition {
            id: "tray.test.child-toggle",
            label: "Child Toggle",
            enabled: true,
            checked: false,
            on_activate: noop_tray_action,
        }),
    ];

    const TEST_MENU_ITEMS: &[SystemTrayMenuItemDefinition] = &[
        SystemTrayMenuItemDefinition::Submenu(SystemTraySubmenuDefinition {
            id: "tray.test.submenu",
            label: "Test Submenu",
            enabled: true,
            items: TEST_SUBMENU_ITEMS,
        }),
        SystemTrayMenuItemDefinition::Separator,
    ];

    fn noop_tray_action(_app_handle: &AppHandle<Wry>) {}

    #[test]
    fn main_system_tray_ids_are_namespaced_and_unique() {
        let mut menu_ids = Vec::new();
        collect_menu_ids(MAIN_SYSTEM_TRAY_DEFINITION.items, &mut menu_ids);

        assert!(!menu_ids.is_empty());
        assert!(menu_ids.iter().all(|menu_id| menu_id.starts_with("tray.")));

        let unique_ids = menu_ids.iter().copied().collect::<BTreeSet<_>>();
        assert_eq!(unique_ids.len(), menu_ids.len());
    }

    #[test]
    fn resolve_menu_action_handler_finds_nested_items() {
        assert!(resolve_menu_action_handler("tray.test.child-action", TEST_MENU_ITEMS).is_some());
        assert!(resolve_menu_action_handler("tray.test.child-toggle", TEST_MENU_ITEMS).is_some());
        assert!(resolve_menu_action_handler("tray.test.submenu", TEST_MENU_ITEMS).is_none());
        assert!(resolve_menu_action_handler("tray.unknown", TEST_MENU_ITEMS).is_none());
    }

    fn collect_menu_ids(
        menu_items: &'static [SystemTrayMenuItemDefinition],
        ids: &mut Vec<&'static str>,
    ) {
        for menu_item in menu_items {
            match menu_item {
                SystemTrayMenuItemDefinition::Action(definition) => ids.push(definition.id),
                SystemTrayMenuItemDefinition::CheckAction(definition) => ids.push(definition.id),
                SystemTrayMenuItemDefinition::Submenu(definition) => {
                    ids.push(definition.id);
                    collect_menu_ids(definition.items, ids);
                }
                SystemTrayMenuItemDefinition::Separator => {}
            }
        }
    }
}
