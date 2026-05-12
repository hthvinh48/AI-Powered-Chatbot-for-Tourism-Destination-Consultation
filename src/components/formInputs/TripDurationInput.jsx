import React, { useState } from "react";
import "./formInputs.css";

const DURATION_PRESETS = [
  { days: 1, label: "1 ngày" },
  { days: 2, label: "2 ngày" },
  { days: 3, label: "3 ngày" },
  { days: 5, label: "5 ngày" },
  { days: 7, label: "1 tuần" },
  { days: 10, label: "10 ngày" },
  { days: 14, label: "2 tuần" },
];

export default function TripDurationInput({ onSubmit, onCancel }) {
  const [days, setDays] = useState(3);
  const [customMode, setCustomMode] = useState(false);

  const handleSubmit = () => {
    if (days < 1) {
      alert("Số ngày phải ít nhất 1");
      return;
    }
    if (days > 30) {
      alert("Số ngày tối đa là 30");
      return;
    }
    onSubmit({ duration: `${days} ngày` });
  };

  return (
    <div className="form-input-container">
      <div className="form-input-group">
        <label>Thời lượng chuyến đi</label>
        {!customMode ? (
          <>
            <div className="duration-presets">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  className={`preset-button ${days === preset.days ? "selected" : ""}`}
                  onClick={() => setDays(preset.days)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              className="btn-custom-duration"
              onClick={() => setCustomMode(true)}
            >
              ⚙️ Tuỳ chỉnh
            </button>
          </>
        ) : (
          <div className="custom-duration">
            <div className="input-group-with-buttons">
              <button
                className="btn-decrement"
                onClick={() => setDays(Math.max(1, days - 1))}
              >
                −
              </button>
              <input
                type="number"
                value={days}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val > 0 && val <= 30) setDays(val);
                }}
                min="1"
                max="30"
                className="number-input"
              />
              <button
                className="btn-increment"
                onClick={() => setDays(Math.min(30, days + 1))}
              >
                +
              </button>
            </div>
            <button
              className="btn-back"
              onClick={() => {
                setCustomMode(false);
                setDays(3);
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
