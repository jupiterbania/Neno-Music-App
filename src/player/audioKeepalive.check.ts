import { startAudioKeepalive, stopAudioKeepalive } from "./audioKeepalive";

if (typeof startAudioKeepalive !== "function" || typeof stopAudioKeepalive !== "function") {
  throw new Error("audioKeepalive exports missing");
}

console.log("audioKeepalive: ok");
