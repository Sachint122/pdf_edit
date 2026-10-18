/**
 * SignatureModal Component
 * Interactive modal supporting freehand signature drawing and image upload.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, PenTool, Upload, RotateCcw, Check } from 'lucide-react';

export function SignatureModal({ isOpen, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('draw'); // 'draw' | 'upload'
  const [penColor, setPenColor] = useState('#0f172a');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  // Clear signature canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, []);

  // Initialize canvas context
  useEffect(() => {
    if (!isOpen || activeTab !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
  }, [isOpen, activeTab, penColor]);

  // Mouse / Touch drawing handlers
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    isDrawingRef.current = true;
    lastPointRef.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const currentX = clientX - rect.left;
    const currentY = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(currentX, currentY);
    ctx.strokeStyle = penColor;
    ctx.stroke();

    lastPointRef.current = { x: currentX, y: currentY };
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  // Upload handler
  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Confirm and insert
  const handleConfirm = () => {
    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    } else {
      if (!uploadedImage) return;
      onSave(uploadedImage);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#131924] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="h-13 px-5 flex items-center justify-between border-b border-white/[0.08] text-white font-semibold text-sm bg-slate-900/50">
          <div className="flex items-center gap-2">
            <PenTool size={16} className="text-emerald-400" />
            <h3 className="font-semibold text-sm text-white">Add Signature</h3>
          </div>
          <button
            type="button"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/[0.08] bg-slate-900/40 p-1.5 gap-1.5">
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'draw'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
            onClick={() => setActiveTab('draw')}
          >
            <PenTool size={13} />
            <span>Draw Signature</span>
          </button>
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={13} />
            <span>Upload Image</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {activeTab === 'draw' ? (
            <div className="flex flex-col gap-3">
              <canvas
                ref={canvasRef}
                width={480}
                height={180}
                className="w-full bg-white rounded-xl border border-slate-700/60 shadow-inner cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Color:</span>
                  <button
                    type="button"
                    className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer bg-slate-950 ${
                      penColor === '#0f172a' ? 'scale-110 border-blue-500 shadow-xs' : 'border-slate-600 hover:scale-105'
                    }`}
                    onClick={() => setPenColor('#0f172a')}
                    title="Black"
                  />
                  <button
                    type="button"
                    className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer bg-blue-600 ${
                      penColor === '#2563eb' ? 'scale-110 border-white shadow-xs' : 'border-slate-600 hover:scale-105'
                    }`}
                    onClick={() => setPenColor('#2563eb')}
                    title="Blue"
                  />
                </div>

                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition-colors"
                  onClick={clearCanvas}
                >
                  <RotateCcw size={12} />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileUpload}
                id="signature-file-input"
                className="hidden"
              />
              {uploadedImage ? (
                <div className="flex flex-col items-center gap-3 p-4 bg-slate-900/60 rounded-xl border border-white/[0.06] w-full">
                  <img src={uploadedImage} alt="Uploaded signature" className="max-h-36 object-contain bg-white rounded-lg p-2" />
                  <label htmlFor="signature-file-input" className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 cursor-pointer transition-colors">
                    Choose Another Image
                  </label>
                </div>
              ) : (
                <label htmlFor="signature-file-input" className="w-full border-2 border-dashed border-slate-700/80 hover:border-blue-500 rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-900/40 hover:bg-slate-900/70 transition-all text-center">
                  <Upload size={32} className="text-blue-400" />
                  <span className="text-xs font-semibold text-white">Click to select a signature image</span>
                  <span className="text-[11px] text-slate-400">PNG with transparent background recommended</span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] flex items-center justify-end gap-2.5 bg-slate-900/50">
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:pointer-events-none shadow-sm shadow-blue-600/30 active:scale-98 transition-all"
            disabled={activeTab === 'draw' ? !hasDrawn : !uploadedImage}
            onClick={handleConfirm}
          >
            <Check size={14} />
            <span>Insert Signature</span>
          </button>
        </div>
      </div>
    </div>
  );
}
