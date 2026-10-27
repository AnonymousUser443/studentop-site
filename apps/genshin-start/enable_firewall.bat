@echo off
echo 正在添加Vite开发服务器防火墙规则...
netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=5173
echo 防火墙规则添加完成！
echo.
echo 现在你的朋友应该可以访问以下地址：
echo http://192.168.128.1:5173/
echo http://192.168.169.1:5173/
echo http://10.194.159.47:5173/
echo.
pause