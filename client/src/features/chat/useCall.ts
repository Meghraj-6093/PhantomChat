import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket, isSocketLive } from "@/lib/socket";
import type { PublicUser } from "@/types";

export type CallState = "idle" | "outgoing" | "incoming" | "active";

export interface CallSession {
  state: CallState;
  kind: "audio" | "video";
  peerId: string | null;
  peerName: string;
  peerAvatar: string | null | undefined;
  muted: boolean;
  cameraOff: boolean;
  screenSharing: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (targetUserId: string, kind: "audio" | "video", name: string, avatar?: string | null) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

export function useCall(): CallSession {
  const [state, setState] = useState<CallState>("idle");
  const [kind, setKind] = useState<"audio" | "video">("audio");
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState("");
  const [peerAvatar, setPeerAvatar] = useState<string | null | undefined>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach((t) => t.stop());
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setState("idle");
    setPeerId(null);
    setMuted(false);
    setCameraOff(false);
    setScreenSharing(false);
    pendingOfferRef.current = null;
  }, [localStream]);

  const createPeer = useCallback(
    (targetUserId: string) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pc.onicecandidate = (e) => {
        if (e.candidate) getSocket()?.emit("call:ice", { targetUserId, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        setRemoteStream(e.streams[0] ?? null);
      };
      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          // keep UI simple: end on hard failure
          if (pc.connectionState === "failed") cleanup();
        }
      };
      pcRef.current = pc;
      return pc;
    },
    [cleanup]
  );

  const getMedia = async (video: boolean) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
    setLocalStream(stream);
    return stream;
  };

  const startCall = useCallback(
    async (targetUserId: string, callKind: "audio" | "video", name: string, avatar?: string | null) => {
      const socket = getSocket();
      // Require a *live* connection: without it the signaling never reaches the
      // peer, so bail before prompting for camera/mic and leaving a call that
      // rings forever.
      if (!socket || !isSocketLive() || state !== "idle") return;
      setKind(callKind);
      setPeerId(targetUserId);
      setPeerName(name);
      setPeerAvatar(avatar);
      setState("outgoing");
      try {
        const stream = await getMedia(callKind === "video");
        const pc = createPeer(targetUserId);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:initiate", { targetUserId, kind: callKind, offer });
      } catch {
        cleanup();
      }
    },
    [cleanup, createPeer, state]
  );

  const acceptCall = useCallback(async () => {
    const socket = getSocket();
    const offer = pendingOfferRef.current;
    if (!socket || !offer || !peerId) return;
    try {
      const stream = await getMedia(kind === "video");
      const pc = createPeer(peerId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("call:answer", { targetUserId: peerId, answer });
      setState("active");
    } catch {
      socket.emit("call:decline", { targetUserId: peerId });
      cleanup();
    }
  }, [cleanup, createPeer, kind, peerId]);

  const declineCall = useCallback(() => {
    if (peerId) getSocket()?.emit("call:decline", { targetUserId: peerId });
    cleanup();
  }, [cleanup, peerId]);

  const endCall = useCallback(() => {
    if (peerId) getSocket()?.emit("call:end", { targetUserId: peerId });
    cleanup();
  }, [cleanup, peerId]);

  const toggleMute = useCallback(() => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted((m) => !m);
  }, [localStream, muted]);

  const toggleCamera = useCallback(() => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = cameraOff));
    setCameraOff((c) => !c);
  }, [localStream, cameraOff]);

  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !peerId) return;
    if (screenSharing) {
      screenTrackRef.current?.stop();
      screenTrackRef.current = null;
      const camTrack = localStream?.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender && camTrack) await sender.replaceTrack(camTrack);
      setScreenSharing(false);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      if (!track) return;
      screenTrackRef.current = track;
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(track);
      } else {
        pc.addTrack(track, display);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        getSocket()?.emit("call:renegotiate", { targetUserId: peerId, offer });
      }
      track.onended = () => toggleScreenShare();
      setScreenSharing(true);
    } catch {
      /* user cancelled */
    }
  }, [localStream, peerId, screenSharing]);

  // Socket event wiring.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onIncoming = (p: { from: PublicUser; kind: "audio" | "video"; offer: RTCSessionDescriptionInit }) => {
      if (state !== "idle") {
        socket.emit("call:decline", { targetUserId: p.from.id });
        return;
      }
      pendingOfferRef.current = p.offer;
      setPeerId(p.from.id);
      setPeerName(p.from.displayName);
      setPeerAvatar(p.from.avatarUrl);
      setKind(p.kind);
      setState("incoming");
    };
    const onAnswered = async (p: { from: string; answer: RTCSessionDescriptionInit }) => {
      await pcRef.current?.setRemoteDescription(p.answer);
      setState("active");
    };
    const onIce = async (p: { from: string; candidate: RTCIceCandidateInit }) => {
      try {
        await pcRef.current?.addIceCandidate(p.candidate);
      } catch {
        /* stale candidate */
      }
    };
    const onDeclined = () => cleanup();
    const onEnded = () => cleanup();
    const onUnavailable = () => cleanup();
    const onRenegotiate = async (p: { from: string; offer: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(p.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("call:renegotiate_answer", { targetUserId: p.from, answer });
    };
    const onRenegotiateAnswer = async (p: { from: string; answer: RTCSessionDescriptionInit }) => {
      await pcRef.current?.setRemoteDescription(p.answer);
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:answered", onAnswered);
    socket.on("call:ice", onIce);
    socket.on("call:declined", onDeclined);
    socket.on("call:ended", onEnded);
    socket.on("call:unavailable", onUnavailable);
    socket.on("call:renegotiate", onRenegotiate);
    socket.on("call:renegotiate_answer", onRenegotiateAnswer);
    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:answered", onAnswered);
      socket.off("call:ice", onIce);
      socket.off("call:declined", onDeclined);
      socket.off("call:ended", onEnded);
      socket.off("call:unavailable", onUnavailable);
      socket.off("call:renegotiate", onRenegotiate);
      socket.off("call:renegotiate_answer", onRenegotiateAnswer);
    };
  }, [cleanup, state]);

  return {
    state, kind, peerId, peerName, peerAvatar, muted, cameraOff, screenSharing,
    localStream, remoteStream,
    startCall, acceptCall, declineCall, endCall, toggleMute, toggleCamera, toggleScreenShare,
  };
}
