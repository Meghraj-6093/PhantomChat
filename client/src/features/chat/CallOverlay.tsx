import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, MonitorUp } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { CallSession } from "./useCall";

export function CallOverlay({ call }: { call: CallSession }) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localRef.current && call.localStream) localRef.current.srcObject = call.localStream;
  }, [call.localStream, call.state]);
  useEffect(() => {
    if (remoteRef.current && call.remoteStream) remoteRef.current.srcObject = call.remoteStream;
    if (remoteAudioRef.current && call.remoteStream) remoteAudioRef.current.srcObject = call.remoteStream;
  }, [call.remoteStream, call.state]);

  if (call.state === "idle") return null;

  const isVideo = call.kind === "video" || call.screenSharing;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="call"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex flex-col bg-background/95 pl-safe pr-safe backdrop-blur-xl"
      >
        {/* Remote media */}
        <div ref={stageRef} className="relative flex flex-1 items-center justify-center">
          {isVideo && call.remoteStream ? (
            <video ref={remoteRef} autoPlay playsInline className="h-full w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className={call.state !== "active" ? "animate-pulse" : undefined}>
                <Avatar src={call.peerAvatar} name={call.peerName || "?"} size="xl" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold">{call.peerName}</h3>
                <p className="text-sm text-muted">
                  {call.state === "outgoing" && "Calling…"}
                  {call.state === "incoming" && `Incoming ${call.kind} call`}
                  {call.state === "active" && "Connected"}
                </p>
              </div>
            </div>
          )}
          <audio ref={remoteAudioRef} autoPlay />

          {/* Local preview */}
          {isVideo && call.localStream && (
            <motion.div
              drag
              dragMomentum={false}
              dragConstraints={stageRef}
              dragElastic={0}
              className="absolute bottom-24 right-4 h-36 w-24 cursor-grab overflow-hidden rounded-2xl border border-line shadow-glass sm:h-44 sm:w-32"
            >
              <video ref={localRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            </motion.div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 pb-10 pb-safe pt-4">
          {call.state === "incoming" ? (
            <>
              <CallButton color="bg-danger" onClick={call.declineCall} label="Decline">
                <PhoneOff className="h-6 w-6" />
              </CallButton>
              <CallButton color="bg-success" onClick={call.acceptCall} label="Accept" pulse>
                <Phone className="h-6 w-6" />
              </CallButton>
            </>
          ) : (
            <>
              <CallButton
                color={call.muted ? "bg-danger" : "bg-card border border-line"}
                onClick={call.toggleMute}
                label={call.muted ? "Unmute" : "Mute"}
              >
                {call.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </CallButton>
              {call.kind === "video" && (
                <CallButton
                  color={call.cameraOff ? "bg-danger" : "bg-card border border-line"}
                  onClick={call.toggleCamera}
                  label={call.cameraOff ? "Camera on" : "Camera off"}
                >
                  {call.cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </CallButton>
              )}
              {call.state === "active" && "getDisplayMedia" in (navigator.mediaDevices ?? {}) && (
                <CallButton
                  color={call.screenSharing ? "bg-primary" : "bg-card border border-line"}
                  onClick={call.toggleScreenShare}
                  label={call.screenSharing ? "Stop sharing" : "Share screen"}
                >
                  <MonitorUp className="h-5 w-5" />
                </CallButton>
              )}
              <CallButton color="bg-danger" onClick={call.endCall} label="End call">
                <PhoneOff className="h-6 w-6" />
              </CallButton>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

function CallButton({
  children,
  color,
  onClick,
  label,
  pulse,
}: {
  children: React.ReactNode;
  color: string;
  onClick: () => void;
  label: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full text-white shadow-soft transition-transform active:scale-90",
          pulse && "animate-pulse",
          color
        )}
        aria-label={label}
      >
        {children}
      </button>
      <span className="text-[10px] text-muted">{label}</span>
    </div>
  );
}
