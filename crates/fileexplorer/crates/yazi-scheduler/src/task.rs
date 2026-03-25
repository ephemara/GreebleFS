use tokio::sync::mpsc;
use yazi_shared::{CompletionToken, Id};

use crate::{TaskProg, hook::HookIn};

#[derive(Clone, Debug)]
pub struct TaskTicket {
	pub id:   Id,
	pub done: CompletionToken,
}

impl From<&Task> for TaskTicket {
	fn from(task: &Task) -> Self { Self { id: task.id, done: task.done.clone() } }
}

#[derive(Debug)]
pub struct Task {
	pub id:          Id,
	pub name:        String,
	pub(crate) prog: TaskProg,
	pub(crate) hook: Option<HookIn>,
	pub done:        CompletionToken,

	pub logs:   String,
	pub logger: Option<mpsc::UnboundedSender<String>>,
}

impl Task {
	pub(super) fn new<T>(id: Id, name: String) -> Self
	where
		T: Into<TaskProg> + Default,
	{
		Self {
			id,
			name,
			prog: T::default().into(),
			hook: None,
			done: Default::default(),

			logs: Default::default(),
			logger: Default::default(),
		}
	}

	pub(crate) fn log(&mut self, line: String) {
		self.logs.push_str(&line);
		self.logs.push('\n');

		if let Some(logger) = &self.logger {
			logger.send(line).ok();
		}
	}

	pub(super) fn set_hook(&mut self, hook: impl Into<HookIn>) { self.hook = Some(hook.into()); }
}
