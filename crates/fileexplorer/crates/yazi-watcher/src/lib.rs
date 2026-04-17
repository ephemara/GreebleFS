yazi_macro::mod_pub!(local remote);

yazi_macro::mod_flat!(backend reporter watched watchee watcher);

pub static WATCHED: yazi_shared::RoCell<parking_lot::RwLock<Watched>> = yazi_shared::RoCell::new();
pub static WATCHER: yazi_shared::RoCell<tokio::sync::Semaphore> = yazi_shared::RoCell::new();

#[cfg(test)]
static WATCHER_TEST_INIT: std::sync::OnceLock<()> = std::sync::OnceLock::new();
#[cfg(test)]
static WATCHER_TEST_LOCK: std::sync::LazyLock<std::sync::Mutex<()>> =
	std::sync::LazyLock::new(|| std::sync::Mutex::new(()));

pub fn init() {
	WATCHED.with(<_>::default);
	WATCHER.init(tokio::sync::Semaphore::new(1));

	local::init();
}

#[cfg(test)]
pub(crate) fn init_test_runtime() {
	yazi_shared::init_tests();
	WATCHER_TEST_INIT.get_or_init(crate::init);
}

#[cfg(test)]
pub(crate) fn lock_test_runtime() -> std::sync::MutexGuard<'static, ()> {
	crate::init_test_runtime();
	WATCHER_TEST_LOCK.lock().expect("watcher test lock poisoned")
}
