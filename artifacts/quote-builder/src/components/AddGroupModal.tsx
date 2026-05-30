import { X } from "lucide-react";
import type { ProductCategory } from "../types";
import { useAppSettings } from "../context/AppSettingsContext";

interface Props {
  catalog: ProductCategory[];
  existingGroupIds: string[];
  onAdd: (categoryId: string) => void;
  onClose: () => void;
}

export default function AddGroupModal({ catalog, existingGroupIds, onAdd, onClose }: Props) {
  const { settings } = useAppSettings();
  const available = catalog.filter(
    (c) => !existingGroupIds.includes(c.id) && !settings.disabledGroupIds.includes(c.id)
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Add Product Group</span>
          <button type="button" className="btn-icon" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {available.length === 0 ? (
          <p className="modal-empty">All categories have been added.</p>
        ) : (
          <div className="modal-options">
            {available.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="modal-option"
                onClick={() => { onAdd(cat.id); onClose(); }}
              >
                <span className="modal-option-name">{cat.name}</span>
                <span className="modal-option-count">{cat.items.length} products</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
