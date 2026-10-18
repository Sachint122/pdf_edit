/**
 * Object Properties Extraction Utility
 * Extracts plain serialized properties from Fabric objects for UI inspector.
 */

export function extractObjectProperties(obj) {
  if (!obj) return null;
  return {
    type: obj.type,
    left: Math.round(obj.left || 0),
    top: Math.round(obj.top || 0),
    width: Math.round((obj.width || 0) * (obj.scaleX || 1)),
    height: Math.round((obj.height || 0) * (obj.scaleY || 1)),
    fill: obj.fill,
    stroke: obj.stroke,
    strokeWidth: obj.strokeWidth,
    opacity: obj.opacity ?? 1,
    fontSize: obj.fontSize,
    fontFamily: obj.fontFamily,
    fontWeight: obj.fontWeight,
    fontStyle: obj.fontStyle,
    underline: !!obj.underline,
    textAlign: obj.textAlign,
  };
}
