import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type SetStateAction,
} from 'react'

export const clampZoom = (zoom: number) => Math.min(2, Math.max(0.1, zoom))

interface ZoomAnchor {
  canvasX: number
  canvasY: number
  viewportX: number
  viewportY: number
}
interface TrackpadGestureEvent extends Event {
  scale?: number
  clientX?: number
  clientY?: number
}

export function useCanvasZoom(
  stageRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const [zoom, setZoomState] = useState(1)
  const committedZoom = useRef(zoom)
  const pendingAnchor = useRef<ZoomAnchor | null>(null)

  useLayoutEffect(() => {
    committedZoom.current = zoom
    const stage = stageRef.current
    const anchor = pendingAnchor.current
    if (stage && anchor) {
      // Apply after the scaled surface has resized, before the browser paints.
      stage.scrollLeft = anchor.canvasX * zoom - anchor.viewportX
      stage.scrollTop = anchor.canvasY * zoom - anchor.viewportY
    }
    pendingAnchor.current = null
  }, [zoom, stageRef])

  const setZoom = useCallback((value: SetStateAction<number>) => {
    pendingAnchor.current = null
    setZoomState((current) =>
      clampZoom(typeof value === 'function' ? value(current) : value),
    )
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !enabled) return

    let gesture: { zoom: number; scale: number } | null = null
    const zoomAt = (
      next: (current: number) => number,
      clientX?: number,
      clientY?: number,
    ) => {
      const bounds = stage.getBoundingClientRect()
      const viewportX =
        clientX !== undefined && Number.isFinite(clientX)
          ? clientX - bounds.left - stage.clientLeft
          : stage.clientWidth / 2
      const viewportY =
        clientY !== undefined && Number.isFinite(clientY)
          ? clientY - bounds.top - stage.clientTop
          : stage.clientHeight / 2
      pendingAnchor.current = {
        canvasX: (stage.scrollLeft + viewportX) / committedZoom.current,
        canvasY: (stage.scrollTop + viewportY) / committedZoom.current,
        viewportX,
        viewportY,
      }
      setZoomState((current) => clampZoom(next(current)))
    }

    const onWheel = (event: WheelEvent) => {
      // Chromium and Firefox report trackpad pinch as Ctrl + wheel.
      // Plain two-finger scrolling keeps the browser's normal canvas panning.
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      // Some WebKit versions also emit wheel events during native gestures.
      if (gesture) return
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? stage.clientHeight
            : 1
      const factor = Math.exp(-event.deltaY * unit * 0.002)
      zoomAt((current) => current * factor, event.clientX, event.clientY)
    }

    const onGestureStart = (event: TrackpadGestureEvent) => {
      event.preventDefault()
      gesture = {
        zoom: committedZoom.current,
        scale:
          event.scale && Number.isFinite(event.scale) && event.scale > 0
            ? event.scale
            : 1,
      }
    }
    const onGestureChange = (event: TrackpadGestureEvent) => {
      if (!gesture) return
      event.preventDefault()
      if (!event.scale || !Number.isFinite(event.scale) || event.scale <= 0)
        return
      const next = (gesture.zoom * event.scale) / gesture.scale
      zoomAt(() => next, event.clientX, event.clientY)
    }
    const onGestureEnd = (event: Event) => {
      if (!gesture) return
      event.preventDefault()
      gesture = null
    }
    const onBlur = () => {
      gesture = null
    }

    // Non-passive listeners stop the browser from zooming the entire page.
    stage.addEventListener('wheel', onWheel, { passive: false })
    stage.addEventListener('gesturestart', onGestureStart, { passive: false })
    stage.addEventListener('gesturechange', onGestureChange, { passive: false })
    stage.addEventListener('gestureend', onGestureEnd, { passive: false })
    window.addEventListener('blur', onBlur)
    return () => {
      stage.removeEventListener('wheel', onWheel)
      stage.removeEventListener('gesturestart', onGestureStart)
      stage.removeEventListener('gesturechange', onGestureChange)
      stage.removeEventListener('gestureend', onGestureEnd)
      window.removeEventListener('blur', onBlur)
      pendingAnchor.current = null
    }
  }, [stageRef, enabled])

  return { zoom, setZoom }
}
