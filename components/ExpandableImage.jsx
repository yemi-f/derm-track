"use client";

import { useState } from "react";
import Lightbox from "./Lightbox";

export default function ExpandableImage({ src, alt = "", style }) {
  const [expanded, setExpanded] = useState(false);

  if (!src) return null;

  return (
    <>
      <img
        src={src}
        alt={alt}
        style={{ ...style, cursor: "zoom-in" }}
        onClick={() => setExpanded(true)}
      />
      <Lightbox open={expanded} onClose={() => setExpanded(false)}>
        <img src={src} alt={alt} style={enlarged} />
      </Lightbox>
    </>
  );
}

const enlarged = {
  maxWidth: "90vw",
  maxHeight: "90vh",
  objectFit: "contain",
  borderRadius: 12,
};
