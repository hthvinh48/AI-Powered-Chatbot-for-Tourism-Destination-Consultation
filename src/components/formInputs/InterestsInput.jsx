import React, { useState } from "react";
import "./formInputs.css";

const INTERESTS_OPTIONS = [
  { id: "food", label: "🍜 Ẩm thực địa phương", icon: "🍜" },
  { id: "culture", label: "🏯 Văn hóa & lịch sử", icon: "🏯" },
  { id: "nature", label: "🏞️ Thiên nhiên & ngoài trời", icon: "🏞️" },
  { id: "adventure", label: "⛰️ Phiêu lưu & hành động", icon: "⛰️" },
  { id: "beach", label: "🏖️ Biển & nghỉ dưỡng", icon: "🏖️" },
  { id: "nightlife", label: "🍺 Đời sống về đêm", icon: "🍺" },
  { id: "shopping", label: "🛍️ Mua sắm", icon: "🛍️" },
  { id: "art", label: "🎨 Nghệ thuật & bảo tàng", icon: "🎨" },
];

export default function InterestsInput({ onSubmit, onCancel }) {
  const [selected, setSelected] = useState([]);

  const handleToggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (selected.length === 0) {
      alert("Vui lòng chọn ít nhất một sở thích");
      return;
    }
    const selectedLabels = selected
      .map((id) => INTERESTS_OPTIONS.find((o) => o.id === id)?.label)
      .join(", ");
    onSubmit({ interests: selectedLabels });
  };

  return (
    <div className="form-input-container">
      <div className="form-input-group">
        <label>Sở thích du lịch của bạn</label>
        <div className="interests-grid">
          {INTERESTS_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`interest-button ${selected.includes(option.id) ? "selected" : ""}`}
              onClick={() => handleToggle(option.id)}
              title={option.label}
            >
              <span className="interest-icon">{option.icon}</span>
              <span className="interest-label">{option.label.split(" ")[1]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="form-buttons">
        <button className="btn-cancel" onClick={onCancel}>
          Hủy
        </button>
        <button className="btn-submit" onClick={handleSubmit}>
          Xác nhận ({selected.length} lựa chọn)
        </button>
      </div>
    </div>
  );
}
