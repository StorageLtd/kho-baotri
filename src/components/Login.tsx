import React, { useState } from "react";
import { Lock, User, Eye, EyeOff, ShieldAlert } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (userName: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const STAFF_ACCOUNTS = [
    { username: "baotri", password: "LTD@123", name: "Nhân viên bảo trì" },
    { username: "admin", password: "LTD@admin", name: "Quản lý bảo trì" }
  ];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const account = STAFF_ACCOUNTS.find(
      (acc) => acc.username === username.trim() && acc.password === password
    );

    if (account) {
      onLoginSuccess(account.name);
    } else {
      setError("Sai tài khoản hoặc mật khẩu hệ thống.");
    }
  };

  return (
    <section className="min-h-screen flex items-center justify-center p-4 bg-radial from-[#122c23] to-[#06100d]">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-emerald-950/10"
      >
        <div className="flex flex-col items-center text-center gap-4 mb-6">
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-center">
            {/* Elegant SVG fallback for the logo */}
            <svg
              className="w-48 h-12 text-emerald-800"
              viewBox="0 0 220 50"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="220" height="50" rx="8" fill="#115e46" />
              <text
                x="50%"
                y="55%"
                dominantBaseline="middle"
                textAnchor="middle"
                fill="#ffffff"
                fontFamily="sans-serif"
                fontWeight="900"
                fontSize="22"
                letterSpacing="1.5"
              >
                LTD VIET NAM
              </text>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              LTD VIET NAM
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Hệ Thống Quản Lý Kho & Bảo Trì Thiết Bị
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="username"
              className="text-xs font-bold text-slate-600 uppercase tracking-wider"
            >
              Tài khoản nhân viên
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <User className="h-5 w-5" />
              </span>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none text-sm transition-all focus:border-[#115e46] focus:ring-4 focus:ring-emerald-700/10"
                placeholder="Nhập tài khoản (ví dụ: baotri, admin)"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-bold text-slate-600 uppercase tracking-wider"
            >
              Mật khẩu
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Lock className="h-5 w-5" />
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="w-full min-h-[44px] pl-10 pr-12 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none text-sm transition-all focus:border-[#115e46] focus:ring-4 focus:ring-emerald-700/10"
                placeholder="Nhập mật khẩu"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 mt-4 text-rose-600 text-sm bg-rose-50 border border-rose-100 p-3 rounded-xl animate-bounce">
            <ShieldAlert className="h-5 w-5 flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="w-full min-h-[46px] mt-6 bg-[#115e46] hover:bg-[#093f2f] text-white font-bold rounded-xl shadow-lg transition-all transform active:scale-98"
        >
          Xác Nhận Đăng Nhập
        </button>
      </form>
    </section>
  );
}
