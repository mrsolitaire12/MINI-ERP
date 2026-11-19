import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  format: (value: number) => string
}

/** Counts up to a number, and counts from the old number to the new one when it changes. */
export function AnimatedNumber({ value, format }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion()
  const [shown, setShown] = useState(reduceMotion ? value : 0)
  const previous = useRef(reduceMotion ? value : 0)

  useEffect(() => {
    if (reduceMotion) {
      previous.current = value
      setShown(value)
      return
    }
    const controls = animate(previous.current, value, {
      duration: 0.7,
      ease: 'easeOut',
      onUpdate: (latest) => setShown(latest),
      onComplete: () => {
        previous.current = value
        setShown(value)
      },
    })
    return () => {
      previous.current = value
      controls.stop()
    }
  }, [value, reduceMotion])

  return <>{format(reduceMotion ? value : shown)}</>
}
