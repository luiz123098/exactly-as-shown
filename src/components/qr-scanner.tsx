import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";

export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let done = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (done) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA && ctx) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const r = jsQR(img.data, img.width, img.height);
            if (r?.data) { done = true; onResult(r.data); return; }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setErr("Não foi possível acessar a câmera. Permita o acesso nas configurações do navegador.");
      }
    })();
    return () => { done = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onResult]);
  return (
    <div className="surface space-y-3 p-4">
      {err ? <p className="text-sm text-destructive">{err}</p> : (
        <div className="relative overflow-hidden rounded-xl bg-ink">
          <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
          <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-highlight" />
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">Aponte a câmera para o QR Code do membro.</p>
      <Button variant="outline" className="w-full" onClick={onClose}>Fechar câmera</Button>
    </div>
  );
}
