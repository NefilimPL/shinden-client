use windows_sys::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::{
        Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
        WindowsAndMessaging::{
            GetWindowLongW, GWL_STYLE, WM_NCCALCSIZE, WM_NCDESTROY, WS_OVERLAPPEDWINDOW,
        },
    },
};

const SUBCLASS_ID: usize = 0x53434653;

// Install on the window's UI thread, after Tao has installed its own subclass.
pub fn install(hwnd: HWND) -> std::io::Result<()> {
    if unsafe { SetWindowSubclass(hwnd, Some(window_proc), SUBCLASS_ID, 0) } == 0 {
        return Err(std::io::Error::last_os_error());
    }
    Ok(())
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _data: usize,
) -> LRESULT {
    // Tao 0.35 retains WS_MAXIMIZE on entry from a maximized window, then
    // limits WM_NCCALCSIZE to rcWork. That leaves a taskbar-sized black strip.
    // Native fullscreen removes WS_OVERLAPPEDWINDOW; ordinary maximization
    // keeps those styles, including in this app's undecorated window.
    // Returning zero preserves the proposed full window rectangle as its
    // client area. Do not call Tauri's blocking window getters in this callback.
    if message == WM_NCCALCSIZE
        && wparam != 0
        && GetWindowLongW(hwnd, GWL_STYLE) as u32 & WS_OVERLAPPEDWINDOW == 0
    {
        return 0;
    }
    if message == WM_NCDESTROY {
        RemoveWindowSubclass(hwnd, Some(window_proc), SUBCLASS_ID);
    }
    DefSubclassProc(hwnd, message, wparam, lparam)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::{
        Foundation::RECT,
        UI::WindowsAndMessaging::{
            CreateWindowExW, DestroyWindow, SendMessageW, NCCALCSIZE_PARAMS, WM_NCCALCSIZE,
            WS_MAXIMIZE, WS_OVERLAPPEDWINDOW, WS_POPUP,
        },
    };

    // Reproduce Tao 0.35's WM_NCCALCSIZE path: a maximized window's client
    // rectangle is reduced to rcWork even when the window is fullscreen.
    unsafe extern "system" fn taskbar_inset_proc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        _data: usize,
    ) -> LRESULT {
        if message == WM_NCCALCSIZE && wparam != 0 {
            (*(lparam as *mut NCCALCSIZE_PARAMS)).rgrc[0].bottom -= 48;
            return 0;
        }
        DefSubclassProc(hwnd, message, wparam, lparam)
    }

    fn client_height(style: u32) -> i32 {
        unsafe {
            let class: Vec<u16> = "STATIC\0".encode_utf16().collect();
            let hwnd = CreateWindowExW(
                0,
                class.as_ptr(),
                null(),
                style,
                0,
                0,
                900,
                700,
                null_mut(),
                null_mut(),
                null_mut(),
                null(),
            );
            assert!(!hwnd.is_null());
            assert_ne!(SetWindowSubclass(hwnd, Some(taskbar_inset_proc), 1, 0), 0);
            install(hwnd).unwrap();
            let mut params = NCCALCSIZE_PARAMS {
                rgrc: [RECT {
                    left: 0,
                    top: 0,
                    right: 1920,
                    bottom: 1080,
                }; 3],
                lppos: null_mut(),
            };
            SendMessageW(hwnd, WM_NCCALCSIZE, 1, &mut params as *mut _ as LPARAM);
            let height = params.rgrc[0].bottom - params.rgrc[0].top;
            DestroyWindow(hwnd);
            height
        }
    }

    #[test]
    fn fullscreen_from_maximized_uses_the_entire_monitor() {
        assert_eq!(client_height(WS_POPUP | WS_MAXIMIZE), 1080);
    }

    #[test]
    fn ordinary_maximization_keeps_the_taskbar_space() {
        assert_eq!(client_height(WS_OVERLAPPEDWINDOW | WS_MAXIMIZE), 1032);
    }
}
