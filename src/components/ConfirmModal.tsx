import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  // New/original API
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  // Backward-compatible aliases already used by EntriesView in ZIP (28)
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  children?: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  description,
  children,
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  confirmVariant,
  variant,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const resolvedMessage = message ?? description;
  const resolvedConfirmText = confirmText ?? confirmLabel ?? 'Confirmar Exclusão';
  const resolvedCancelText = cancelText ?? cancelLabel ?? 'Cancelar';
  const resolvedVariant = confirmVariant ?? variant ?? 'danger';
  const isDanger = resolvedVariant === 'danger';

  return (
    <div
      id="confirm-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="confirm-modal-box"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-full ${
                isDanger
                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400'
                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400'
              }`}
            >
              {isDanger ? <Trash2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              {title}
            </h3>
          </div>
          <button
            id="btn-confirm-modal-close"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs text-slate-700 dark:text-slate-300">
          {resolvedMessage && (typeof resolvedMessage === 'string' ? <p className="leading-relaxed">{resolvedMessage}</p> : resolvedMessage)}
          {children}
        </div>

        <div className="flex justify-end items-center gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
          <button
            id="btn-confirm-modal-cancel"
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded transition-colors"
          >
            {resolvedCancelText}
          </button>
          <button
            id="btn-confirm-modal-confirm"
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-white font-semibold text-xs rounded shadow-2xs transition-colors ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                : resolvedVariant === 'primary'
                  ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                  : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
            }`}
          >
            {isDanger ? <Trash2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {resolvedConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
