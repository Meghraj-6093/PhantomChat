import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Send, Paperclip, Smile, Mic, X, Pencil, Reply as ReplyIcon,
  CalendarClock, Square, Loader2, ImagePlus,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useEditMessage, useSendMessage, uploadFiles } from "@/hooks/useMessages";
import { getSocket } from "@/lib/socket";
import { cn, formatBytes } from "@/lib/utils";
import { EmojiPicker } from "./EmojiPicker";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { Attachment, MessageType } from "@/types";

export function Composer({ chatId, slowModeSeconds }: { chatId: string; slowModeSeconds: number }) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingRef = useRef<{ active: boolean; timer: ReturnType<typeof setTimeout> | null }>({ active: false, timer: null });

  const replyTo = useChatStore((s) => s.replyTo);
  const editing = useChatStore((s) => s.editing);
  const setReplyTo = useChatStore((s) => s.setReplyTo);
  const setEditing = useChatStore((s) => s.setEditing);

  const sendMessage = useSendMessage();
  const editMessage = useEditMessage();

  // One object URL per attached image, created when the file list changes (not
  // on every keystroke) and revoked when it changes again or on unmount — so
  // typing a caption for a photo doesn't leak a new blob URL per character.
  const filePreviews = useMemo(
    () => files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)),
    [files]
  );
  useEffect(() => {
    return () => filePreviews.forEach((url) => url && URL.revokeObjectURL(url));
  }, [filePreviews]);

  useEffect(() => {
    if (editing) {
      setText(editing.content ?? "");
      textareaRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    setText("");
    setFiles([]);
    setError(null);
  }, [chatId]);

  // auto-grow
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const emitTyping = () => {
    const socket = getSocket();
    if (!socket) return;
    if (!typingRef.current.active) {
      typingRef.current.active = true;
      socket.emit("typing:start", chatId);
    }
    if (typingRef.current.timer) clearTimeout(typingRef.current.timer);
    typingRef.current.timer = setTimeout(() => {
      typingRef.current.active = false;
      socket.emit("typing:stop", chatId);
    }, 2500);
  };

  const doSend = async (scheduledFor?: string) => {
    const content = text.trim();
    if (!content && files.length === 0) return;
    setError(null);

    let attachments: Attachment[] = [];
    let type: MessageType = "TEXT";
    try {
      if (files.length) {
        setUploading(true);
        attachments = await uploadFiles(files);
        const first = files[0]!;
        type = first.type.startsWith("image/") ? "IMAGE"
          : first.type.startsWith("video/") ? "VIDEO"
          : first.type.startsWith("audio/") ? "AUDIO"
          : "FILE";
      }

      if (editing) {
        await editMessage.mutateAsync({ chatId, messageId: editing.id, content });
        setEditing(null);
      } else {
        await sendMessage.mutateAsync({
          chatId,
          content: content || undefined,
          type,
          replyToId: replyTo?.id,
          attachments,
          scheduledFor,
        });
        setReplyTo(null);
      }
      setText("");
      setFiles([]);
      getSocket()?.emit("typing:stop", chatId);
      typingRef.current.active = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setUploading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
    if (e.key === "Escape") {
      setEditing(null);
      setReplyTo(null);
    }
  };

  // ── Voice recording ──
  const startRecording = async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Voice recording isn't supported on this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        const blob = new Blob(chunks, { type: mime });
        if (blob.size < 1000) return; // discard accidental taps
        const file = new File([blob], `voice-${Date.now()}.${mime.includes("webm") ? "webm" : "m4a"}`, { type: mime });
        setUploading(true);
        try {
          const attachments = await uploadFiles([file]);
          await sendMessage.mutateAsync({ chatId, type: "VOICE", attachments });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Voice message failed");
        } finally {
          setUploading(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("Microphone access denied — allow it in your browser settings");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("No microphone found on this device");
      } else if (name === "NotReadableError") {
        setError("Your microphone is already in use by another app");
      } else {
        setError("Couldn't start recording");
      }
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = [...list].slice(0, 5);
    const tooBig = arr.find((f) => f.size > 25 * 1024 * 1024);
    if (tooBig) {
      setError(`${tooBig.name} exceeds the 25 MB limit`);
      return;
    }
    setFiles(arr);
  };

  return (
    <div className="relative border-t border-line px-3 pb-3 pt-2 pb-safe sm:px-4">
      {/* Reply / edit banner */}
      <AnimatePresence>
        {(replyTo || editing) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="mb-2 flex items-center gap-2 overflow-hidden rounded-xl border border-line bg-card/60 px-3 py-2"
          >
            {editing ? <Pencil className="h-4 w-4 shrink-0 text-warning" /> : <ReplyIcon className="h-4 w-4 shrink-0 text-primary-soft" />}
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-medium text-primary-soft">
                {editing ? "Editing message" : `Replying to ${replyTo?.sender?.displayName ?? "message"}`}
              </p>
              <p className="truncate text-muted">{(editing ?? replyTo)?.content ?? "attachment"}</p>
            </div>
            <button
              onClick={() => {
                setEditing(null);
                setReplyTo(null);
                setText("");
              }}
              className="text-muted hover:text-slate-100"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected files */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-line bg-card/60 px-3 py-1.5 text-xs">
              {filePreviews[i] ? (
                <img src={filePreviews[i]!} alt="" className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <Paperclip className="h-4 w-4 text-muted" />
              )}
              <div>
                <p className="max-w-[140px] truncate font-medium">{f.name}</p>
                <p className="text-muted">{formatBytes(f.size)}</p>
              </div>
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted hover:text-danger">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mb-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger">{error}</p>
      )}

      {/* Emoji picker */}
      <AnimatePresence>
        {emojiOpen && (
          <div className="absolute bottom-full left-3 z-20 mb-2">
            <EmojiPicker
              onPick={(e) => {
                setText((t) => t + e);
                textareaRef.current?.focus();
              }}
            />
          </div>
        )}
      </AnimatePresence>

      {recording ? (
        <div className="flex items-center gap-3 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3">
          <span className="h-2.5 w-2.5 animate-pulse-dot rounded-full bg-danger" />
          <span className="flex-1 text-sm font-medium">
            Recording… {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")}
          </span>
          <Button size="icon" variant="danger" onClick={stopRecording} title="Stop & send">
            <Square className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              onPickFiles(e.target.files);
              // Clear so picking the same file again still fires onChange.
              e.currentTarget.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-xl p-2.5 text-muted transition-all hover:bg-slate-700/40 hover:text-slate-100 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
            title="Attach files"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = "image/*,video/*";
                fileInputRef.current.click();
                fileInputRef.current.accept = "";
              }
            }}
            disabled={uploading}
            className="hidden rounded-xl p-2.5 text-muted transition-all hover:bg-slate-700/40 hover:text-slate-100 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 sm:block"
            title="Photos & videos"
          >
            <ImagePlus className="h-5 w-5" />
          </button>

          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                emitTyping();
              }}
              onKeyDown={onKeyDown}
              placeholder={slowModeSeconds > 0 ? `Slow mode: 1 message / ${slowModeSeconds}s` : "Message…  (**markdown** supported)"}
              className="input-base max-h-40 min-h-[44px] resize-none py-3 pr-10"
            />
            <button
              onClick={() => setEmojiOpen((o) => !o)}
              className={cn(
                "absolute bottom-2.5 right-2.5 rounded-lg p-1 transition-all active:scale-90",
                emojiOpen ? "text-primary-soft" : "text-muted hover:text-slate-100"
              )}
              title="Emoji"
            >
              <Smile className="h-5 w-5" />
            </button>
          </div>

          <button
            onClick={() => setScheduleOpen(true)}
            className="hidden rounded-xl p-2.5 text-muted transition-all hover:bg-slate-700/40 hover:text-slate-100 active:scale-90 sm:block"
            title="Schedule message"
          >
            <CalendarClock className="h-5 w-5" />
          </button>

          {text.trim() || files.length ? (
            <button
              onClick={() => doSend()}
              disabled={uploading}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-glow transition-transform active:scale-90 disabled:opacity-60",
                uploading && "spin-border"
              )}
              title="Send"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={uploading}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line text-muted transition-all hover:text-slate-100 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
              title="Voice message"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
        </div>
      )}

      {/* Schedule modal */}
      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule message">
        <p className="mb-3 text-sm text-muted">The message will be delivered automatically at the chosen time.</p>
        <input
          type="datetime-local"
          value={scheduleAt}
          onChange={(e) => setScheduleAt(e.target.value)}
          className="input-base"
          min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
        />
        <Button
          className="mt-4 w-full"
          disabled={!scheduleAt || !text.trim()}
          onClick={() => {
            doSend(new Date(scheduleAt).toISOString());
            setScheduleOpen(false);
            setScheduleAt("");
          }}
        >
          <CalendarClock className="h-4 w-4" /> Schedule
        </Button>
        {!text.trim() && <p className="mt-2 text-center text-xs text-muted">Type a message first, then schedule it.</p>}
      </Modal>
    </div>
  );
}
