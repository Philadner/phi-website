import { useState, useEffect } from "react";

type ImageModalProps = {
  src: string;
  alt?: string;
  width?: number | string;
};

export default function ImageModal({
  src,
  alt = "",
  width = 300,
}: ImageModalProps) {
  const [open, setOpen] = useState(false);

  // Close on ESC
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    if (open) {
      window.addEventListener("keydown", handleKey);
    }

    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <>
      {/* Thumbnail */}
      <img
        src={src}
        alt={alt}
        style={{ width, cursor: "pointer" }}
        onClick={() => setOpen(true)}
      />

      {/* Modal */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <img
            src={src}
            alt={alt}
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              objectFit: "contain",
            }}
          />
        </div>
      )}
    </>
  );
}