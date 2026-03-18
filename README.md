# AI-Powered Chatbot for Tourism Destination Consultation

## Kết nối API (http://localhost:3000) với Frontend

### 1) Backend (folder `api/`)
- Copy `api/.env.example` → `api/.env` và điền biến môi trường cần thiết
- Chạy API (ví dụ): `cd api` rồi `node server.js`

API mặc định chạy: `http://localhost:3000` và có endpoint kiểm tra: `GET /api/health`.

Nếu frontend dùng Clerk, backend cần thêm các biến `CLERK_JWKS_URL` và `CLERK_SECRET_KEY` để đổi Clerk session token → JWT của backend qua endpoint `POST /api/auth/clerk/exchange`.

### 2) Frontend (root)
- Copy `.env.example` → `.env`
- Set:
  - `VITE_API_BASE_URL=http://localhost:3000`
  - `VITE_CLERK_PUBLISHABLE_KEY=...` (lấy từ Clerk Dashboard)
- Chạy frontend: `npm run dev`

## Admin (trong cùng project)

Admin UI dùng layout tham khảo từ `src/template/` và chạy trong cùng frontend:
- URL: `http://localhost:5173/admin`
- Yêu cầu role `ADMIN` hoặc `SUPER_ADMIN` (role nằm trong DB của backend).

