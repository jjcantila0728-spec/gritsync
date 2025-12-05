import { useState, useRef, useEffect } from 'react'
import { Button } from './Button'
import { Crop, RotateCw, ZoomIn, ZoomOut, Grid } from 'lucide-react'

interface ImageCropProps {
  image: File
  aspectRatio?: number
  onCrop: (croppedFile: File) => void
  onCancel: () => void
}

export function ImageCrop({ image, aspectRatio = 1, onCrop, onCancel }: ImageCropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 100, y: 100 }) // Default position to ensure visibility
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingCrop, setIsDraggingCrop] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 })
  const [cropSize, setCropSize] = useState({ width: 0, height: 0 })
  const [rotation, setRotation] = useState(0)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [showGrid, setShowGrid] = useState(false)
  const [cropMode, setCropMode] = useState(false)
  const [imageUrl, setImageUrl] = useState<string>('')

  useEffect(() => {
    // Create object URL immediately for display
    const url = URL.createObjectURL(image)
    setImageUrl(url)
    
    const img = new Image()
    img.onload = () => {
      setImageLoaded(true)
      imageRef.current = img
      setImageSize({ width: img.width, height: img.height })
      
      // Use setTimeout to ensure container is rendered
      setTimeout(() => {
        if (containerRef.current) {
          const container = containerRef.current
          const containerWidth = container.clientWidth || 800
          const containerHeight = container.clientHeight || 500
          
          const imgAspect = img.width / img.height
          let displayWidth = containerWidth * 0.8
          let displayHeight = displayWidth / imgAspect
          
          if (displayHeight > containerHeight * 0.8) {
            displayHeight = containerHeight * 0.8
            displayWidth = displayHeight * imgAspect
          }
          
          setPosition({
            x: (containerWidth - displayWidth) / 2,
            y: (containerHeight - displayHeight) / 2,
          })
          setScale(1)
          
          // Initialize crop area to fit within image bounds
          const imageLeft = (containerWidth - displayWidth) / 2
          const imageTop = (containerHeight - displayHeight) / 2
          
          // Start with a crop area that fits within the image
          const maxCropWidth = displayWidth * 0.8
          const maxCropHeight = displayHeight * 0.8
          
          let initialCropWidth = maxCropWidth
          let initialCropHeight = maxCropHeight
          
          // If aspect ratio is specified, maintain it
          if (aspectRatio) {
            if (initialCropWidth / initialCropHeight > aspectRatio) {
              initialCropWidth = initialCropHeight * aspectRatio
            } else {
              initialCropHeight = initialCropWidth / aspectRatio
            }
          }
          
          // Center crop area within image
          const cropX = imageLeft + (displayWidth - initialCropWidth) / 2
          const cropY = imageTop + (displayHeight - initialCropHeight) / 2
          
          setCropPosition({ x: cropX, y: cropY })
          setCropSize({ width: initialCropWidth, height: initialCropHeight })
        }
      }, 100)
    }
    img.onerror = () => {
      setImageLoaded(false)
    }
    img.src = url

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [image, aspectRatio])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    
    const cropArea = getCropArea()
    if (!cropArea) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    // Check if clicking on resize handles - only in crop mode, only corner handles
    if (cropMode) {
      const handleSize = 12 // Larger hit area for corner handles
      const handles = {
        'nw': { x: cropArea.x, y: cropArea.y },
        'ne': { x: cropArea.x + cropArea.width, y: cropArea.y },
        'sw': { x: cropArea.x, y: cropArea.y + cropArea.height },
        'se': { x: cropArea.x + cropArea.width, y: cropArea.y + cropArea.height },
      }
      
      // Check which corner handle is being clicked
      for (const [handle, pos] of Object.entries(handles)) {
        if (
          mouseX >= pos.x - handleSize &&
          mouseX <= pos.x + handleSize &&
          mouseY >= pos.y - handleSize &&
          mouseY <= pos.y + handleSize
        ) {
          setResizeHandle(handle)
          setDragStart({
            x: mouseX - cropArea.x,
            y: mouseY - cropArea.y,
          })
          e.stopPropagation()
          return
        }
      }
    }
    
    // Check if clicking on crop area (for dragging) - only in crop mode
    if (cropMode &&
        mouseX >= cropArea.x &&
        mouseX <= cropArea.x + cropArea.width &&
        mouseY >= cropArea.y &&
        mouseY <= cropArea.y + cropArea.height) {
      // Dragging crop area
      setIsDraggingCrop(true)
      setDragStart({ 
        x: mouseX - cropPosition.x, 
        y: mouseY - cropPosition.y 
      })
      e.stopPropagation()
      return
    }
    
    // Dragging image
    setIsDragging(true)
    setDragStart({ 
      x: (e.clientX - rect.left) - position.x, 
      y: (e.clientY - rect.top) - position.y 
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (resizeHandle && cropMode && containerRef.current) {
      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const imgAspect = imageSize.width / imageSize.height
      const displayWidth = container.clientWidth * 0.8 * scale
      const displayHeight = displayWidth / imgAspect
      const imageLeft = position.x
      const imageTop = position.y
      const imageRight = imageLeft + displayWidth
      const imageBottom = imageTop + displayHeight
      
      let newX = cropPosition.x
      let newY = cropPosition.y
      let newWidth = cropSize.width
      let newHeight = cropSize.height
      
      // Calculate new dimensions based on resize handle
      switch (resizeHandle) {
        case 'nw':
          newWidth = cropPosition.x + cropSize.width - mouseX
          newHeight = cropPosition.y + cropSize.height - mouseY
          newX = mouseX
          newY = mouseY
          break
        case 'ne':
          newWidth = mouseX - cropPosition.x
          newHeight = cropPosition.y + cropSize.height - mouseY
          newY = mouseY
          break
        case 'sw':
          newWidth = cropPosition.x + cropSize.width - mouseX
          newHeight = mouseY - cropPosition.y
          newX = mouseX
          break
        case 'se':
          newWidth = mouseX - cropPosition.x
          newHeight = mouseY - cropPosition.y
          break
      }
      
      // Maintain aspect ratio if specified (for corner handles)
      if (aspectRatio && resizeHandle) {
        // Calculate which dimension changed more
        const widthChange = Math.abs(newWidth - cropSize.width)
        const heightChange = Math.abs(newHeight - cropSize.height)
        
        if (widthChange > heightChange) {
          // Width changed more, adjust height
          newHeight = newWidth / aspectRatio
          if (resizeHandle === 'nw' || resizeHandle === 'ne') {
            newY = cropPosition.y + cropSize.height - newHeight
          }
        } else {
          // Height changed more, adjust width
          newWidth = newHeight * aspectRatio
          if (resizeHandle === 'nw' || resizeHandle === 'sw') {
            newX = cropPosition.x + cropSize.width - newWidth
          }
        }
      }
      
      // Minimum size
      const minSize = 50
      if (newWidth < minSize) {
        if (resizeHandle === 'nw' || resizeHandle === 'sw') {
          newX = cropPosition.x + cropSize.width - minSize
        }
        newWidth = minSize
        if (aspectRatio) {
          newHeight = newWidth / aspectRatio
          if (resizeHandle === 'nw' || resizeHandle === 'ne') {
            newY = cropPosition.y + cropSize.height - newHeight
          }
        }
      }
      if (newHeight < minSize) {
        if (resizeHandle === 'nw' || resizeHandle === 'ne') {
          newY = cropPosition.y + cropSize.height - minSize
        }
        newHeight = minSize
        if (aspectRatio) {
          newWidth = newHeight * aspectRatio
          if (resizeHandle === 'nw' || resizeHandle === 'sw') {
            newX = cropPosition.x + cropSize.width - newWidth
          }
        }
      }
      
      // Constrain to image bounds
      newX = Math.max(imageLeft, Math.min(newX, imageRight - newWidth))
      newY = Math.max(imageTop, Math.min(newY, imageBottom - newHeight))
      newWidth = Math.min(newWidth, imageRight - newX)
      newHeight = Math.min(newHeight, imageBottom - newY)
      
      setCropPosition({ x: newX, y: newY })
      setCropSize({ width: newWidth, height: newHeight })
    } else if (isDraggingCrop && containerRef.current) {
      const container = containerRef.current
      const cropArea = getCropArea()
      if (!cropArea) return
      
      const rect = container.getBoundingClientRect()
      const newX = e.clientX - rect.left - dragStart.x
      const newY = e.clientY - rect.top - dragStart.y
      
      // Constrain crop area to image bounds
      const imgAspect = imageSize.width / imageSize.height
      const displayWidth = container.clientWidth * 0.8 * scale
      const displayHeight = displayWidth / imgAspect
      const imageLeft = position.x
      const imageTop = position.y
      const imageRight = imageLeft + displayWidth
      const imageBottom = imageTop + displayHeight
      
      const minX = imageLeft
      const maxX = imageRight - cropArea.width
      const minY = imageTop
      const maxY = imageBottom - cropArea.height
      
      setCropPosition({
        x: Math.max(minX, Math.min(maxX, newX)),
        y: Math.max(minY, Math.min(maxY, newY)),
      })
    } else if (isDragging && containerRef.current) {
      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const imgAspect = imageSize.width / imageSize.height
      const displayWidth = container.clientWidth * 0.8 * scale
      const displayHeight = displayWidth / imgAspect
      
      const newX = e.clientX - rect.left - dragStart.x
      const newY = e.clientY - rect.top - dragStart.y
      
      // Constrain to keep image centered and prevent parts from being hidden
      // Calculate center position
      const centerX = (container.clientWidth - displayWidth) / 2
      const centerY = (container.clientHeight - displayHeight) / 2
      
      // Allow some movement but keep it relatively centered
      // Limit movement to 30% of container size from center
      const maxOffsetX = container.clientWidth * 0.3
      const maxOffsetY = container.clientHeight * 0.3
      
      const offsetX = newX - centerX
      const offsetY = newY - centerY
      
      const constrainedX = centerX + Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX))
      const constrainedY = centerY + Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY))
      
      // Also ensure image doesn't go outside container bounds
      const minX = Math.min(0, container.clientWidth - displayWidth)
      const maxX = Math.max(0, container.clientWidth - displayWidth)
      const minY = Math.min(0, container.clientHeight - displayHeight)
      const maxY = Math.max(0, container.clientHeight - displayHeight)
      
      setPosition({
        x: Math.max(minX, Math.min(maxX, constrainedX)),
        y: Math.max(minY, Math.min(maxY, constrainedY)),
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsDraggingCrop(false)
    setResizeHandle(null)
  }
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(prev => {
      const newScale = Math.max(0.5, Math.min(3, prev + delta))
      // Auto-center image when zooming
      if (containerRef.current) {
        const container = containerRef.current
        const imgAspect = imageSize.width / imageSize.height
        const displayWidth = container.clientWidth * 0.8 * newScale
        const displayHeight = displayWidth / imgAspect
        setPosition({
          x: (container.clientWidth - displayWidth) / 2,
          y: (container.clientHeight - displayHeight) / 2,
        })
      }
      return newScale
    })
  }

  const handleZoomIn = () => {
    setScale(prev => {
      const newScale = Math.min(prev + 0.1, 3)
      // Auto-center image when zooming
      if (containerRef.current) {
        const container = containerRef.current
        const imgAspect = imageSize.width / imageSize.height
        const displayWidth = container.clientWidth * 0.8 * newScale
        const displayHeight = displayWidth / imgAspect
        setPosition({
          x: (container.clientWidth - displayWidth) / 2,
          y: (container.clientHeight - displayHeight) / 2,
        })
      }
      return newScale
    })
  }

  const handleZoomOut = () => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.1, 0.5)
      // Auto-center image when zooming
      if (containerRef.current) {
        const container = containerRef.current
        const imgAspect = imageSize.width / imageSize.height
        const displayWidth = container.clientWidth * 0.8 * newScale
        const displayHeight = displayWidth / imgAspect
        setPosition({
          x: (container.clientWidth - displayWidth) / 2,
          y: (container.clientHeight - displayHeight) / 2,
        })
      }
      return newScale
    })
  }

  const handleRotate = () => {
    setRotation(prev => {
      const newRotation = (prev + 90) % 360
      // Auto-center image when rotating
      if (containerRef.current) {
        const container = containerRef.current
        const imgAspect = imageSize.width / imageSize.height
        const displayWidth = container.clientWidth * 0.8 * scale
        const displayHeight = displayWidth / imgAspect
        setPosition({
          x: (container.clientWidth - displayWidth) / 2,
          y: (container.clientHeight - displayHeight) / 2,
        })
      }
      return newRotation
    })
  }

  const _handleReset = () => {
    if (containerRef.current && imageRef.current) {
      const container = containerRef.current
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight
      
      const imgAspect = imageSize.width / imageSize.height
      let displayWidth = containerWidth * 0.8
      let displayHeight = displayWidth / imgAspect
      
      if (displayHeight > containerHeight * 0.8) {
        displayHeight = containerHeight * 0.8
        displayWidth = displayHeight * imgAspect
      }
      
      setPosition({
        x: (containerWidth - displayWidth) / 2,
        y: (containerHeight - displayHeight) / 2,
      })
      setScale(1)
      setRotation(0)
      
      // Reset crop area
      const imageLeft = (containerWidth - displayWidth) / 2
      const imageTop = (containerHeight - displayHeight) / 2
      
      const maxCropWidth = displayWidth * 0.8
      const maxCropHeight = displayHeight * 0.8
      
      let initialCropWidth = maxCropWidth
      let initialCropHeight = maxCropHeight
      
      if (aspectRatio) {
        if (initialCropWidth / initialCropHeight > aspectRatio) {
          initialCropWidth = initialCropHeight * aspectRatio
        } else {
          initialCropHeight = initialCropWidth / aspectRatio
        }
      }
      
      const cropX = imageLeft + (displayWidth - initialCropWidth) / 2
      const cropY = imageTop + (displayHeight - initialCropHeight) / 2
      
      setCropPosition({ x: cropX, y: cropY })
      setCropSize({ width: initialCropWidth, height: initialCropHeight })
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          handleRotate()
        }
      } else if (e.key === 'Escape') {
        onCancel()
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleCrop()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCancel])

  const getCropArea = () => {
    if (!containerRef.current || cropSize.width === 0 || cropSize.height === 0) return null
    
    return {
      x: cropPosition.x,
      y: cropPosition.y,
      width: cropSize.width,
      height: cropSize.height,
    }
  }

  const handleCrop = () => {
    if (!canvasRef.current || !imageRef.current || !containerRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cropArea = getCropArea()
    if (!cropArea) return

    const img = imageRef.current
    const container = containerRef.current
    
    // Calculate displayed image dimensions
    const imgAspect = img.width / img.height
    const displayWidth = container.clientWidth * 0.8 * scale
    const displayHeight = displayWidth / imgAspect
    
    // Calculate scale factors from displayed to original image
    const scaleX = img.width / displayWidth
    const scaleY = img.height / displayHeight
    
    // Calculate source coordinates in the original image
    // Account for image position relative to crop area (using cropPosition)
    const relativeX = cropArea.x - position.x
    const relativeY = cropArea.y - position.y
    
    let sourceX = relativeX * scaleX
    let sourceY = relativeY * scaleY
    let sourceWidth = cropArea.width * scaleX
    let sourceHeight = cropArea.height * scaleY
    
    // Ensure we don't go outside image bounds
    sourceX = Math.max(0, Math.min(sourceX, img.width - sourceWidth))
    sourceY = Math.max(0, Math.min(sourceY, img.height - sourceHeight))
    sourceWidth = Math.min(sourceWidth, img.width - sourceX)
    sourceHeight = Math.min(sourceHeight, img.height - sourceY)

    // Set canvas size to desired output size (maintain crop area aspect ratio)
    const cropAspect = cropArea.width / cropArea.height
    const outputSize = 800 // High quality output
    const outputWidth = cropAspect >= 1 ? outputSize : outputSize * cropAspect
    const outputHeight = cropAspect >= 1 ? outputSize / cropAspect : outputSize
    
    canvas.width = outputWidth
    canvas.height = outputHeight

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Handle rotation - we need to rotate the source image before cropping
    if (rotation !== 0) {
      // Create a temporary canvas to rotate the image
      const tempCanvas = document.createElement('canvas')
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) return
      
      // Rotate the entire image
      const rotatedWidth = rotation === 90 || rotation === 270 ? img.height : img.width
      const rotatedHeight = rotation === 90 || rotation === 270 ? img.width : img.height
      
      tempCanvas.width = rotatedWidth
      tempCanvas.height = rotatedHeight
      
      tempCtx.translate(rotatedWidth / 2, rotatedHeight / 2)
      tempCtx.rotate((rotation * Math.PI) / 180)
      tempCtx.drawImage(img, -img.width / 2, -img.height / 2)
      
      // Adjust source coordinates for rotation
      let rotatedSourceX = sourceX
      let rotatedSourceY = sourceY
      let rotatedSourceWidth = sourceWidth
      let rotatedSourceHeight = sourceHeight
      
      if (rotation === 90) {
        rotatedSourceX = sourceY
        rotatedSourceY = img.width - sourceX - sourceWidth
        rotatedSourceWidth = sourceHeight
        rotatedSourceHeight = sourceWidth
      } else if (rotation === 180) {
        rotatedSourceX = img.width - sourceX - sourceWidth
        rotatedSourceY = img.height - sourceY - sourceHeight
      } else if (rotation === 270) {
        rotatedSourceX = img.height - sourceY - sourceHeight
        rotatedSourceY = sourceX
        rotatedSourceWidth = sourceHeight
        rotatedSourceHeight = sourceWidth
      }
      
      // Draw the cropped and rotated image
      ctx.drawImage(
        tempCanvas,
        rotatedSourceX,
        rotatedSourceY,
        rotatedSourceWidth,
        rotatedSourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      )
    } else {
      // Draw the cropped image without rotation
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      )
    }

    // Convert to blob and create file
    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], image.name, { type: image.type })
        onCrop(croppedFile)
      }
    }, image.type, 0.95)
  }

  const cropArea = getCropArea()
  // Use fallback aspect ratio if image not loaded yet
  const imgAspect = imageSize.width > 0 && imageSize.height > 0 
    ? imageSize.width / imageSize.height 
    : (imageUrl ? 1 : 1) // Default to 1:1 if we have URL but no dimensions yet
  const containerWidth = containerRef.current?.clientWidth || 800
  const containerHeight = containerRef.current?.clientHeight || 500
  const baseDisplayWidth = containerWidth * 0.8 * scale
  const displayWidth = baseDisplayWidth > 0 ? baseDisplayWidth : 600
  const displayHeight = displayWidth / imgAspect

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Calculate crop dimensions in pixels (approximate)
  const cropWidthPx = cropArea ? Math.round(cropArea.width) : 0
  const cropHeightPx = cropArea ? Math.round(cropArea.height) : 0

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          Drag the white frame to reposition, drag the handles to resize, drag the image to move it, scroll to zoom, and use controls to rotate. The area inside the white frame will be cropped.
        </p>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className="relative w-full h-[500px] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 rounded-lg overflow-hidden cursor-move border-2 border-gray-300 dark:border-gray-700 shadow-inner"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Image */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Preview"
            className="absolute pointer-events-none"
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
            draggable={false}
            onLoad={(e) => {
              // Ensure image is visible even if calculations haven't completed
              const img = e.currentTarget
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                if (!imageLoaded) {
                  setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
                }
                if (containerRef.current && (displayWidth === 0 || position.x === 0)) {
                  const container = containerRef.current
                  const containerWidth = container.clientWidth || 800
                  const containerHeight = container.clientHeight || 500
                  
                  // Fallback sizing
                  const imgAspect = img.naturalWidth / img.naturalHeight
                  const fallbackWidth = Math.min(containerWidth * 0.8, 600)
                  const fallbackHeight = fallbackWidth / imgAspect
                  
                  if (fallbackHeight > containerHeight * 0.8) {
                    const adjustedHeight = containerHeight * 0.8
                    const adjustedWidth = adjustedHeight * imgAspect
                    setPosition({
                      x: (containerWidth - adjustedWidth) / 2,
                      y: (containerHeight - adjustedHeight) / 2,
                    })
                  } else {
                    setPosition({
                      x: (containerWidth - fallbackWidth) / 2,
                      y: (containerHeight - fallbackHeight) / 2,
                    })
                  }
                }
              }
            }}
          />
        )}

        {/* Crop Overlay - Only show in crop mode */}
        {cropMode && cropArea && (
          <>
            {/* Dark overlay - gray out the image */}
            <div
              className="absolute inset-0 bg-black/60 pointer-events-none transition-opacity"
              style={{
                clipPath: `polygon(
                  0% 0%,
                  0% 100%,
                  ${cropArea.x}px 100%,
                  ${cropArea.x}px ${cropArea.y}px,
                  ${cropArea.x + cropArea.width}px ${cropArea.y}px,
                  ${cropArea.x + cropArea.width}px ${cropArea.y + cropArea.height}px,
                  ${cropArea.x}px ${cropArea.y + cropArea.height}px,
                  ${cropArea.x}px 100%,
                  100% 100%,
                  100% 0%
                )`,
              }}
            />
            
            {/* Grid overlay */}
            {showGrid && (
              <div
                className="absolute pointer-events-none opacity-30"
                style={{
                  left: `${cropArea.x}px`,
                  top: `${cropArea.y}px`,
                  width: `${cropArea.width}px`,
                  height: `${cropArea.height}px`,
                }}
              >
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="grid" width="33.33%" height="33.33%" patternUnits="userSpaceOnUse">
                      <path d="M 33.33 0 L 0 0 0 33.33" fill="none" stroke="white" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>
            )}

            {/* Crop frame - draggable - only show in crop mode */}
            <div
              className="absolute border-[3px] border-white shadow-2xl cursor-move ring-2 ring-primary-500/50 transition-opacity"
              style={{
                left: `${cropArea.x}px`,
                top: `${cropArea.y}px`,
                width: `${cropArea.width}px`,
                height: `${cropArea.height}px`,
                opacity: cropMode ? 1 : 0,
              }}
              onMouseDown={(e) => {
                if (!cropMode) return
                e.stopPropagation()
                if (!containerRef.current) return
                const rect = containerRef.current.getBoundingClientRect()
                const mouseX = e.clientX - rect.left
                const mouseY = e.clientY - rect.top
                setIsDraggingCrop(true)
                setDragStart({ 
                  x: mouseX - cropPosition.x, 
                  y: mouseY - cropPosition.y 
                })
              }}
            >
              {/* Crop dimensions display */}
              {cropMode && (
                <div className="absolute -top-8 left-0 bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                  {cropWidthPx} × {cropHeightPx} px
                </div>
              )}
              {/* Corner handles - Only 4 corner points, larger and more visible */}
              {cropMode && (
                <>
                  <div 
                    className="absolute w-6 h-6 border-2 border-white bg-primary-600 rounded-full cursor-nwse-resize z-10 hover:bg-primary-700 hover:scale-125 transition-all shadow-lg"
                    style={{ 
                      left: '-12px',
                      top: '-12px',
                    }}
                  ></div>
                  <div 
                    className="absolute w-6 h-6 border-2 border-white bg-primary-600 rounded-full cursor-nesw-resize z-10 hover:bg-primary-700 hover:scale-125 transition-all shadow-lg"
                    style={{ 
                      right: '-12px',
                      top: '-12px',
                    }}
                  ></div>
                  <div 
                    className="absolute w-6 h-6 border-2 border-white bg-primary-600 rounded-full cursor-nesw-resize z-10 hover:bg-primary-700 hover:scale-125 transition-all shadow-lg"
                    style={{ 
                      left: '-12px',
                      bottom: '-12px',
                    }}
                  ></div>
                  <div 
                    className="absolute w-6 h-6 border-2 border-white bg-primary-600 rounded-full cursor-nwse-resize z-10 hover:bg-primary-700 hover:scale-125 transition-all shadow-lg"
                    style={{ 
                      right: '-12px',
                      bottom: '-12px',
                    }}
                  ></div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={scale <= 0.5}
                className="h-8 w-8 p-0"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[70px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={scale >= 3}
                className="h-8 w-8 p-0"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotate}
              title="Rotate 90° (R)"
              className="bg-white dark:bg-gray-900"
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Rotate
            </Button>
            
            <Button
              variant={cropMode ? "default" : "outline"}
              size="sm"
              onClick={() => setCropMode(!cropMode)}
              title="Toggle crop mode"
              className={cropMode ? "bg-primary-600 text-white hover:bg-primary-700" : "bg-white dark:bg-gray-900"}
            >
              <Crop className="h-4 w-4 mr-2" />
              Crop
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGrid(!showGrid)}
              title="Toggle grid overlay"
              className={`bg-white dark:bg-gray-900 ${showGrid ? 'ring-2 ring-primary-500' : ''}`}
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onCancel} className="bg-white dark:bg-gray-900">
              Cancel
            </Button>
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <Button variant="outline" onClick={onCancel} className="bg-white dark:bg-gray-900">
          Cancel
        </Button>
        <Button 
          onClick={handleCrop} 
          className="bg-primary-600 hover:bg-primary-700 text-white shadow-md"
          disabled={!cropMode}
        >
          <Crop className="h-4 w-4 mr-2" />
          Apply Changes
        </Button>
      </div>
      
      {/* Status Bar */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2">
        <div className="flex items-center gap-4">
          <span>Image: {imageSize.width} × {imageSize.height}px</span>
          {cropMode && (
            <>
              <span>•</span>
              <span>Crop: {cropWidthPx} × {cropHeightPx}px</span>
            </>
          )}
          {rotation !== 0 && (
            <>
              <span>•</span>
              <span>Rotated: {rotation}°</span>
            </>
          )}
        </div>
        {cropMode && (
          <div className="text-gray-400 dark:text-gray-500">
            Drag the 4 corner points to adjust crop area
          </div>
        )}
      </div>

      {/* Hidden canvas for cropping */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
