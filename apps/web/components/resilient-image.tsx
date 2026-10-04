'use client';

import Image, { type ImageProps } from 'next/image';
import { forwardRef, useState } from 'react';

/** Keep the surrounding layout and a branded gradient when an image cannot load. */
export const ResilientImage = forwardRef<HTMLImageElement, ImageProps>(function ResilientImage(
  { src, className = '', onError, ...props }, ref,
) {
  const [failedSource, setFailedSource] = useState<ImageProps['src'] | null>(null);
  if (failedSource === src) {
    return (
      <span
        role={props.alt ? 'img' : undefined}
        aria-label={props.alt || undefined}
        aria-hidden={props.alt ? undefined : true}
        className={`${props.fill ? 'absolute inset-0 ' : 'inline-block '}${className}`}
        style={{
          ...props.style,
          width: props.fill ? undefined : props.width,
          height: props.fill ? undefined : props.height,
          background: 'linear-gradient(135deg,#ede4ff,#bd9be9,#627e91)',
        }}
      />
    );
  }
  return <Image {...props} alt={props.alt} ref={ref} src={src} unoptimized={src === '/brand/spacelink-mark.png' || props.unoptimized} className={className} onError={(event) => {
    setFailedSource(src);
    onError?.(event);
  }} />;
});
