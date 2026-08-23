import { io } from "socket.io-client";
import { API_BASE_URL } from "./api";

const socket = io(API_BASE_URL, {
    autoConnect: true
});

export default socket;
