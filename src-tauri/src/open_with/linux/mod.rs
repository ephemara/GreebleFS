//

mod desktop;
mod mime;
mod open;

pub use open::{get_associated_programs_impl, open_with_desktop_id};

use std::time::Duration;

pub(super) const OPEN_WITH_LINUX_COMMAND_TIMEOUT: Duration = Duration::from_millis(1200);
