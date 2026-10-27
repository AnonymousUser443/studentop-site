@echo off
echo 正在创建8080端口防火墙规则...
netsh advfirewall firewall add rule name="Vite Dev Server 8080" dir=in action=allow protocol=TCP localport=8080
echo.
echo 如果你的朋友无法访问端口3000，请试试这些地址：
echo http://192.168.128.1:8080/
echo http://192.168.169.1:8080/
echo http://10.194.159.47:8080/
echo.
echo 注意：需要先在vite.config.ts中将端口改为8080
pause