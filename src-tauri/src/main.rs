// Desktop builds use the application log instead of opening a console window.
#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

fn main() {
    shinden_client_rs_lib::run()
}
