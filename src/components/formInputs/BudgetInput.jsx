import React, { useState } from "react";
import "./formInputs.css";

const BUDGET_PRESETS = [
  { value: "Dưới 5 triệu", min: 0, max: 5000000 },
  { value: "5-10 triệu", min: 5000000, max: 10000000 },
  { value: "10-20 triệu", min: 10000000, max: 20000000 },
  { value: "20-50 triệu", min: 20000000, max: 50000000 },
  { value: "Trên 50 triệu", min: 50000000, max: Infinity },
];

function formatCurrency(value) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)} triệu`;
  }
  return `${value.toLocaleString("vi-VN")} đ`;
}

export default function BudgetInput({ onSubmit, onCancel }) {
  const [selected, setSelected] = useState("10-20 triệu");
  const [customMode, setCustomMode] = useState(false);
  const [customAmount, setCustomAmount] = useState(15000000);

  const handleSubmit = () => {
    const budgetValue = customMode ? customAmount : selected;
    if (!budgetValue) {
      alert("Vui lòng chọn ngân sách");
      return;
    }
    onSubmit({ budget: budgetValue.toString() });
  };

  return (
    <div className="form-input-container">
      <div className="form-input-group">
        <label>Ngân sách dự kiến</label>
        {!customMode ? (
          <>
            <div className="budget-presets">
              {BUDGET_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  className={`preset-button ${selected === preset.value ? "selected" : ""}`}
                  onClick={() => setSelected(preset.value)}
                >
                  💰 {preset.value}
                </button>
              ))}
            </div>
            <button
              className="btn-custom-budget"
              onClick={() => setCustomMode(true)}
            >
              ⚙️ Nhập số tiền cụ thể
            </button>
          </>
        ) : (
          <div className="custom-budget">
            <div className="custom-input-group">
              <input
                type="number"
                value={customAmount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 0) setCustomAmount(val);
                }}
                placeholder="Nhập số tiền (đồng)"
                className="text-input"
              />
              <span className="currency-display">
                = {formatCurrency(customAmount)}
              </span>
            </div>
            <button
              className="btn-back"
              onClick={() => {
                setCustomMode(false);
                setCustomAmount(15000000);
              }}
            >
              ← Quay lại
            </button>
          </div>
        )}
      </div>
      <div className="form-buttons">
        <button className="btn-cancel" onClick={onCancel}>
          Hủy
        </button>
        <button className="btn-submit" onClick={handleSubmit}>
          Xác nhận
        </button>
      </div>
    </div>
  );
}
