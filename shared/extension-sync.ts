// Classic extension worker bundle. No network or storage is accessed on import.
export * from "./sync-core";
export {createFirebaseAuth} from "./firebase-auth";
export {createFirebaseLibrary} from "./firebase-library";
export {createFirebaseSessionManager} from "./firebase-session";
