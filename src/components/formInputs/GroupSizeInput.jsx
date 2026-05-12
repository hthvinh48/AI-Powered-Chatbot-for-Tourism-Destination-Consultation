import React, { useState } from "react";
import "./formInputs.css";

export default function GroupSizeInput({ onSubmit, onCancel }) {
  const [groupSize, setGroupSize] = useState(1);

  const handleSubmit = () => {
    if (groupSize < 1) {
      alert("Vui lòng chọn ít nhất 1 người");
      return;
    }
    onSubmit({ group_size: groupSize.toString() });
  };

  return (
    <div className="form-input-container">
      <div className="form-input-group">
        <label>Số lượng người trong nhóm</label>
        <div className="input-group-with-buttons">
          <button
            className="btn-decrement"
            onClick={() => setGroupSize(Math.max(1, groupSize - 1))}
          >
            −
          </button>
          <input
            type="number"
            value={groupSize}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val > 0) setGroupSize(val);
            }}
            min="1"
            max="50"
            className="number-input"
          />
          <button
            className="btn-increment"
            onClick={() => setGroupSize(Math.min(50, groupSize + 1))}
          >
            +
          </button>
        </div>
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
