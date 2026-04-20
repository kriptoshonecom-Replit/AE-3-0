import React, { useState, useEffect } from "react";
import type { QuoteGroup as QuoteGroupType, ProductCategory, QuoteLineItem } from "../types";
import { groupSubtotal, formatCurrency, generateId } from "../utils/calculations";
import { getAdditionalExcludedIds, computeLineItemTotal, isTieredItem } from "../utils/quoteLogic";

interface Props {
  group: QuoteGroupType;
  catalog: ProductCategory[];
  onChange: (group: QuoteGroupType) => void;
  onRemove: () => void;
}

export default function QuoteGroup({ group, catalog, onChange, onRemove }: Props) {
  const [isOpen, setIsOpen] = useState(group.isOpen);

  const toggle = () => {
    setIsOpen((v) => !v);
    onChange({ ...group, isOpen: !isOpen });
  };

  const addLine = () => {
    const newItem: QuoteLineItem = {
      id: generateId(),
      productId: "",
      productName: "",
      unitPrice: 0,
      quantity: 1,
      note: "",
    };
    onChange({ ...group, lineItems: [...group.lineItems, newItem] });
  };

  const updateLine = (idx: number, updated: QuoteLineItem) => {
    const items = group.lineItems.map((item, i) => (i === idx ? updated : item));
    onChange({ ...group, lineItems: items });
  };

  const removeLine = (idx: number) => {
    const items = group.lineItems.filter((_, i) => i !== idx);
    onChange({ ...group, lineItems: items });
  };

  const selectProduct = (idx: number, productId: string) => {
    if (!productId) {
      updateLine(idx, { ...group.lineItems[idx], productId: "", productName: "", unitPrice: 0 });
      return;
    }
    for (const cat of catalog) {
      const found = cat.items.find((p) => p.id === productId);
      if (found) {
        updateLine(idx, {
          ...group.lineItems[idx],
          productId: found.id,
          productName: found.name,
          unitPrice: found.price,
        });
        return;
      }
    }
  };

  const subtotal = groupSubtotal(group);

  return (
    <div className={`quote-group ${isOpen ? "open" : ""}`}>
      <button className="group-header" onClick={toggle} type="button">
        <div className="group-header-left">
          <span className={`chevron ${isOpen ? "rotated" : ""}`}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="group-name">{group.categoryName}</span>
          {group.lineItems.length > 0 && (
            <span className="group-count">{group.lineItems.length} item{group.lineItems.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="group-header-right">
          {subtotal > 0 && <span className="group-subtotal">{formatCurrency(subtotal)}</span>}
          <button
            className="btn-icon danger"
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Remove group"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </button>

      {isOpen && (
        <div className="group-body">
          {group.lineItems.length > 0 && (
            <div className="line-table">
              <div className="line-row header">
                <div className="col-product">Product</div>
                <div className="col-info" />
                <div className="col-qty">Qty</div>
                <div className="col-price">Unit Price</div>
                <div className="col-total">Total</div>
                <div className="col-actions" />
              </div>

              {group.lineItems.map((item, idx) => {
                const usedIds = group.lineItems
                  .filter((_, i) => i !== idx)
                  .map((li) => li.productId)
                  .filter(Boolean);
                const excludedIds = [...usedIds, ...getAdditionalExcludedIds(usedIds)];
                return (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    catalog={catalog}
                    groupId={group.categoryId}
                    usedProductIds={excludedIds}
                    onProductChange={(pid) => selectProduct(idx, pid)}
                    onQtyChange={(qty) => updateLine(idx, { ...item, quantity: qty })}
                    onPriceChange={(price) => updateLine(idx, { ...item, unitPrice: price })}
                    onRemove={() => removeLine(idx)}
                  />
                );
              })}
            </div>
          )}

          {group.lineItems.length === 0 && (
            <div className="group-empty">
              No items yet. Click "Add item" to start.
            </div>
          )}

          {(() => {
            const cat = catalog.find((c) => c.id === group.categoryId);
            const selectedIds = group.lineItems.map((li) => li.productId).filter(Boolean);
            const allUsed = cat ? selectedIds.length >= cat.items.length : false;
            return !allUsed ? (
              <button className="btn-add-line" type="button" onClick={addLine}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Add item
              </button>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

interface LineItemRowProps {
  item: QuoteLineItem;
  catalog: ProductCategory[];
  groupId: string;
  usedProductIds: string[];
  onProductChange: (id: string) => void;
  onQtyChange: (qty: number) => void;
  onPriceChange: (price: number) => void;
  onRemove: () => void;
}

function LineItemRow({ item, catalog, groupId, usedProductIds, onProductChange, onQtyChange, onPriceChange, onRemove }: LineItemRowProps) {
  const allCategoryItems = catalog.find((c) => c.id === groupId)?.items ?? [];
  const categoryItems = allCategoryItems.filter((p) => !usedProductIds.includes(p.id));

  const product = allCategoryItems.find((p) => p.id === item.productId);
  const infoEntry = product?.type && product?.text ? { type: product.type, text: product.text } : undefined;
  const [modalOpen, setModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  useEffect(() => {
    if (!modalOpen && !imageModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setModalOpen(false); setImageModalOpen(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [modalOpen, imageModalOpen]);

  return (
    <div className="line-item-wrapper">
      <div className="line-row">
        <div className="col-product">
          <select
            value={item.productId}
            onChange={(e) => onProductChange(e.target.value)}
            className={!item.productId ? "placeholder" : ""}
          >
            <option value="">Select product…</option>
            {categoryItems.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-info">
          {product?.image && (
            <>
              <button
                type="button"
                className="info-icon-btn"
                onClick={() => setImageModalOpen(true)}
                title="View product image"
                aria-label="View product image"
              >
                <img
                  src="/product-btn.png"
                  alt="View product"
                  className="info-icon-img"
                  style={{ width: 25, height: 25 }}
                />
              </button>
              {imageModalOpen && (
                <div
                  className="info-modal-backdrop"
                  onMouseDown={(e) =>
                    e.target === e.currentTarget && setImageModalOpen(false)
                  }
                >
                  <div
                    className="info-modal"
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ maxWidth: 480 }}
                  >
                    <div className="info-modal-header info" style={{ marginBottom: 12 }}>
                      <img
                        src="/product-btn.png"
                        alt="Product"
                        className="info-modal-icon"
                        style={{ width: 28, height: 28 }}
                      />
                      <span>{product.name}</span>
                    </div>
                    <img
                      src={product.image}
                      alt={product.name}
                      style={{
                        width: "100%",
                        borderRadius: 8,
                        objectFit: "contain",
                        maxHeight: 320,
                        background: "var(--surface-subtle)",
                      }}
                    />
                    <button
                      type="button"
                      className="info-modal-close"
                      onClick={() => setImageModalOpen(false)}
                      style={{ marginTop: 12 }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {infoEntry && (
            <>
              <button
                type="button"
                className="info-icon-btn"
                onClick={() => setModalOpen(true)}
                title={infoEntry.type === "warning" ? "Warning" : "Info"}
                aria-label={infoEntry.type === "warning" ? "Warning" : "Info"}
              >
                <img
                  src={infoEntry.type === "warning" ? "/warning-btn.png" : "/info-btn.png"}
                  alt={infoEntry.type === "warning" ? "Warning" : "Info"}
                  className="info-icon-img"
                  style={{ width: 25, height: 25 }}
                />
              </button>
              {modalOpen && (
                <div className="info-modal-backdrop" onMouseDown={() => setModalOpen(false)}>
                  <div
                    className={`info-modal ${infoEntry.type}`}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className={`info-modal-header ${infoEntry.type}`}>
                      <img
                        src={infoEntry.type === "warning" ? "/warning-btn.png" : "/info-btn.png"}
                        alt={infoEntry.type === "warning" ? "Warning" : "Info"}
                        className="info-modal-icon"
                        style={{ width: 30, height: 30 }}
                      />
                      <span>{infoEntry.type === "warning" ? "Warning" : "Info"}</span>
                    </div>
                    <p className="info-modal-text">{infoEntry.text}</p>
                    <button
                      type="button"
                      className="info-modal-close"
                      onClick={() => setModalOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="col-qty">
          <input
            type="number"
            min="0"
            step="1"
            value={item.quantity}
            onChange={(e) => onQtyChange(Math.max(0, parseInt(e.target.value) || 0))}
            onFocus={(e) => e.target.select()}
            className="qty-input"
          />
        </div>

        <div className="col-price">
          <div className="price-input-wrap">
            <span className="price-prefix">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={item.unitPrice}
              onChange={(e) => onPriceChange(Math.max(0, parseFloat(e.target.value) || 0))}
              className="price-input"
            />
          </div>
        </div>

        <div className="col-total">
          <span className="total-value">
            {formatCurrency(computeLineItemTotal(item.productId, item.unitPrice, item.quantity))}
          </span>
          {isTieredItem(item.productId) && item.quantity > 1 && (
            <span className="tiered-hint">$30 / add'l unit</span>
          )}
        </div>

        <div className="col-actions">
          <button type="button" className="btn-icon danger" onClick={onRemove} title="Remove item">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
