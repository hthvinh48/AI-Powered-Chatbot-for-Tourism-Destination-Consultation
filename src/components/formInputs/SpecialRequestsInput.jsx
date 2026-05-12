import React, { useState } from "react";
import "./formInputs.css";

export default function SpecialRequestsInput({ onSubmit, onCancel }) {
  const [requests, setRequests] = useState("");

  const handleSubmit = () => {
    const trimmed = requests.trim();
    if (!trimmed) {
      alert("Vui lòng nhập yêu cầu đặc biệt");
      return;
    }
    onSubmit({ preferences: trimmed });
  };

  return (
    <div className="form-input-container">
      <div className="form-input-group">
        <label>Yêu cầu đặc biệt</label>
        <textarea
          value={requests}
          onChange={(e) => setRequests(e.target.value)}
          placeholder="Ví dụ: Tránh quá mệt, ưa thích các nhà hàng nhỏ, muốn có thời gian riêng..."
          className="textarea-input"
          rows="4"
        />
        <p className="help-text">
          Hãy chia sẻ các yêu cầu đặc biệt, ưu tiên hoặc hạn chế để chúng tôi
          có thể tùy chỉnh kế hoạch tốt hơn.
        </p>
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
