# Ghi chú bảo trì

- JavHD dùng iframe Vidara: lấy `filecode` từ URL `/e/{code}` rồi POST JSON tới `/api/stream`, gửi URL iframe làm `Referer`; API trả URL HLS.
- Rphang hiện dùng domain `rphang.land`. Video quảng cáo có thể nằm ngoài bài viết, nên chỉ lấy media trong `.message-body .bbWrapper`.
- Viet69 có thể trả link Googlevideo trong HTML Blogger với dấu ngoặc được mã hóa thành `&quot;`; giải mã dấu phân cách và neo regex vào hostname để tránh lấy nhầm cả chuỗi HTML làm URL phát.
