/**
 * Shape Tools for Fabric.js Canvas
 * Supports Rectangles, Circles, Lines, and Arrows.
 */

import { Rect, Circle, Line, Group, Triangle } from 'fabric';

export const DEFAULT_SHAPE_OPTIONS = {
  fill: 'rgba(59, 130, 246, 0.2)',
  stroke: '#3b82f6',
  strokeWidth: 2,
  opacity: 1,
};

/**
 * Add a Rectangle to the canvas.
 */
export function addRectangle(canvas, options = {}) {
  if (!canvas) return null;

  const center = canvas.getCenterPoint ? canvas.getCenterPoint() : { x: 150, y: 150 };
  const width = options.width || 140;
  const height = options.height || 90;

  const rect = new Rect({
    left: options.left ?? Math.max(20, center.x - width / 2),
    top: options.top ?? Math.max(20, center.y - height / 2),
    width,
    height,
    fill: options.fill ?? DEFAULT_SHAPE_OPTIONS.fill,
    stroke: options.stroke ?? DEFAULT_SHAPE_OPTIONS.stroke,
    strokeWidth: options.strokeWidth ?? DEFAULT_SHAPE_OPTIONS.strokeWidth,
    opacity: options.opacity ?? DEFAULT_SHAPE_OPTIONS.opacity,
    cornerColor: '#3b82f6',
    cornerSize: 8,
    transparentCorners: false,
  });

  canvas.add(rect);
  canvas.setActiveObject(rect);
  canvas.renderAll();
  return rect;
}

/**
 * Add a Circle to the canvas.
 */
export function addCircle(canvas, options = {}) {
  if (!canvas) return null;

  const center = canvas.getCenterPoint ? canvas.getCenterPoint() : { x: 150, y: 150 };
  const radius = options.radius || 45;

  const circle = new Circle({
    left: options.left ?? Math.max(20, center.x - radius),
    top: options.top ?? Math.max(20, center.y - radius),
    radius,
    fill: options.fill ?? DEFAULT_SHAPE_OPTIONS.fill,
    stroke: options.stroke ?? DEFAULT_SHAPE_OPTIONS.stroke,
    strokeWidth: options.strokeWidth ?? DEFAULT_SHAPE_OPTIONS.strokeWidth,
    opacity: options.opacity ?? DEFAULT_SHAPE_OPTIONS.opacity,
    cornerColor: '#3b82f6',
    cornerSize: 8,
    transparentCorners: false,
  });

  canvas.add(circle);
  canvas.setActiveObject(circle);
  canvas.renderAll();
  return circle;
}

/**
 * Add a straight Line to the canvas.
 */
export function addLine(canvas, options = {}) {
  if (!canvas) return null;

  const center = canvas.getCenterPoint ? canvas.getCenterPoint() : { x: 150, y: 150 };
  const length = options.length || 150;

  const line = new Line([
    options.left ?? center.x - length / 2,
    options.top ?? center.y,
    options.left ? options.left + length : center.x + length / 2,
    options.top ?? center.y,
  ], {
    stroke: options.stroke ?? DEFAULT_SHAPE_OPTIONS.stroke,
    strokeWidth: options.strokeWidth ?? 3,
    cornerColor: '#3b82f6',
    cornerSize: 8,
    transparentCorners: false,
  });

  canvas.add(line);
  canvas.setActiveObject(line);
  canvas.renderAll();
  return line;
}

/**
 * Add a directional Arrow to the canvas.
 */
export function addArrow(canvas, options = {}) {
  if (!canvas) return null;

  const center = canvas.getCenterPoint ? canvas.getCenterPoint() : { x: 150, y: 150 };
  const length = options.length || 150;
  const strokeColor = options.stroke ?? DEFAULT_SHAPE_OPTIONS.stroke;
  const strokeWidth = options.strokeWidth ?? 3;

  const line = new Line([0, 0, length - 12, 0], {
    stroke: strokeColor,
    strokeWidth,
    originX: 'left',
    originY: 'center',
  });

  const arrowHead = new Triangle({
    width: 14,
    height: 14,
    fill: strokeColor,
    left: length - 12,
    top: 0,
    angle: 90,
    originX: 'center',
    originY: 'center',
  });

  const arrow = new Group([line, arrowHead], {
    left: options.left ?? Math.max(20, center.x - length / 2),
    top: options.top ?? center.y,
    cornerColor: '#3b82f6',
    cornerSize: 8,
    transparentCorners: false,
  });

  canvas.add(arrow);
  canvas.setActiveObject(arrow);
  canvas.renderAll();
  return arrow;
}
