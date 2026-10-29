/* =====================================================================
   ★ 站点内容 —— 想改主页，只改这一个文件就够了 ★
   改完刷新浏览器即可，不需要构建、不需要重启服务。
   ===================================================================== */
window.SITE = {

  /* ---------- 个人资料 ---------- */
  profile: {
    name: 'Aiden',
    display: 'Aiden',
    handle: '@AnonymousUser443',
    avatar: 'assets/img/avatar-aiden.jpg', // 公开头像；加载失败时保留文字回退
    avatarText: 'A',
    role: '学生 · 全栈折腾者',
    tagline: '把生活折腾成自己喜欢的样子',
    school: '北京理工大学',
    location: '北京 · 海淀',
    email: 'aiden@studentop.cn',      // 改成你自己的邮箱
    domain: 'studentop.cn',
    status: '在线 · 随时欢迎来信',
    // 关于我：可以多段，回车分段
    bio: [
      '你好，我是 Aiden，一名在北京读书的学生。喜欢把想法做成能跑起来的东西：写点前端，折腾树莓派，偶尔研究一下内网穿透，让宿舍里那块小板子也能被世界访问到。',
      '这个页面也是我在慢慢打磨的作品。Windows 11 的操作习惯，配上一点青玉、纸张和山水。双击图标可以打开窗口，手机上轻点就好；终端里也藏了几条可试的模拟命令。',
      '如果你也对「用网页复刻真实系统」这件事感兴趣，欢迎随时找我聊聊。'
    ],
    // 快速信息卡片
    facts: [
      { icon: 'cpu',    label: '正在折腾', value: '树莓派 & 自建服务' },
      { icon: 'code',   label: '主要语言', value: 'JavaScript / Python' },
      { icon: 'globe',  label: '本站跑在', value: 'Raspberry Pi 4B' },
      { icon: 'clock',  label: '上网时间', value: '深夜出没' }
    ],
    // 社交链接（url 为空则自动隐藏）
    links: [
      { icon: 'mail',     label: '写邮件',   url: 'mailto:aiden@studentop.cn', display: 'aiden@studentop.cn' },
      { icon: 'github',   label: 'GitHub',   url: 'https://github.com/AnonymousUser443', display: '@AnonymousUser443' },
      { icon: 'globe',    label: '本站',     url: 'https://studentop.cn:14355', display: 'studentop.cn:14355' },
      { icon: 'image',    label: '相册',     url: '', display: '（待补充）' }
    ]
  },

  /* ---------- 项目 ---------- */
  projects: [
    {
      id: 'frost-atlas',
      title: '北湖霜降雅集',
      subtitle: '理韵文化协会 2026 霜降雅集 · 交互游园图',
      desc: '把一整幅北湖秋景做成可以逛的网页：六艺打卡、霜信收藏、双面明信片。原生前端 + Node 24 服务端（内置 SQLite），零第三方依赖，跑在树莓派上，照片与账户只存在服务器私有卷里。',
      tags: ['HTML', 'CSS', 'JavaScript', 'Node.js', 'SQLite', '树莓派'],
      year: '2026',
      icon: 'frost',
      link: 'https://frost.studentop.cn:14355/'
    },
    {
      id: 'liyun-explorer',
      title: '理韵寻踪 · 校园探索 HUD',
      subtitle: '在一纸山水间，发现北理校园的故事',
      desc: '软件工程导论研究型课程的 HUD 前端：纸山水质感的地图、手绘校园点位、p5.js 画面层与 React 状态机，配合 Web Audio 做氛围音。导论课的作业，也是我想象里「校园导览」该有的样子。',
      tags: ['React', 'TypeScript', 'Vite', 'p5.js', 'Web Audio'],
      year: '2026',
      icon: 'liyun',
      link: 'https://liyun.studentop.cn:14355/'
    },
    {
      id: 'genshin-start',
      title: '理韵 · 纸境入场',
      subtitle: '循光走进北理校园',
      desc: '以文博中心和北理校园意象为线索，用原创程序几何搭起一段轻量 3D 入场。纸色门庭、玉绿山层与晨光相接；这是校园意象的艺术化拼接，不是精确复刻。',
      tags: ['Three.js', 'TypeScript', 'Vite', '交互设计'],
      year: '2026',
      icon: 'genshin',
      link: 'https://studentop.cn:14355/campus-entry/'
    },
    {
      id: 'genshin-original',
      title: '原神启动 · 原版',
      subtitle: '天空、柱路与开门动画 · 独立新标签页',
      desc: '与纸境校园和体素校园分别保留。线上入口保持既有原版子域站点，不重新分发本地恢复包；恢复包涉及的第三方游戏素材与缺失上游许可仍需公开再分发审核。',
      tags: ['Three.js', '原版恢复', '独立入口', '本地验收'],
      year: '2026',
      icon: 'genshin-original',
      link: 'https://genshin.studentop.cn:14355/'
    },
    {
      id: 'voxel-campus',
      title: '体素校园',
      subtitle: '以方块构成的校园空间 · 独立新标签页',
      desc: '体素校园的独立入口。与「理韵 · 纸境入场」和「原神启动 · 原版」分别保留，点击后在新标签页打开，不替换既有入场体验。',
      tags: ['体素', '校园', '独立入口'],
      year: '2026',
      icon: 'voxel-campus',
      link: 'https://studentop.cn:14355/voxel-campus/'
    },
    {
      id: 'rpi-task-manager',
      appId: 'rpi-task-manager',
      title: '树莓派任务管理器',
      subtitle: '仿 Windows 11 的实时资源监控面板',
      desc: '一个跑在树莓派上的 Web 任务管理器：真实读取 CPU 分核、内存、磁盘、网络和温度，60 秒历史曲线，接口只读且只监听回环地址。',
      tags: ['Python', 'aiohttp', '原生前端', '树莓派'],
      year: '2026',
      icon: 'task-manager',
      link: ''
    },
    {
      id: 'win11-home',
      title: '仿 Windows 11 个人主页',
      subtitle: '你正在看的这个页面',
      desc: '原生桌面前端 + 私密 Node 问答服务：窗口管理器支持拖动、缩放、贴边分屏，配有开始菜单、搜索、日历和通知；登录校验由服务端处理。',
      tags: ['HTML', 'CSS', 'JavaScript', '设计'],
      year: '2026',
      icon: 'projects',
      link: 'https://studentop.cn:14355'
    },
    {
      id: 'pi-stress',
      title: '树莓派 4B 压力测试',
      subtitle: '温度、降频与内存的极限试探',
      desc: '对 Raspberry Pi 4B 做的连续负载测试与记录：CPU 温度曲线、是否触发降频、内存与 SD 卡读写变化，最后整理成一份可复现的报告。',
      tags: ['Linux', '性能测试', '树莓派'],
      year: '2026',
      icon: 'skills',
      link: ''
    },
    {
      id: 'midi-player',
      title: '本地 MIDI 播放器',
      subtitle: '把 .mid 丢进去就能听',
      desc: '一个轻量的本地 MIDI 播放与校验小工具，用来检查音轨、通道与音色映射是否符合预期，适合在没装 DAW 的机器上快速试听。',
      tags: ['Python', '音频', '工具'],
      year: '2026',
      icon: 'notepad',
      link: ''
    }
  ],

  /* ---------- 技能 ---------- */
  skills: [
    {
      group: '前端',
      icon: 'code',
      items: [
        { name: 'HTML / CSS', level: 86 },
        { name: 'JavaScript', level: 80 },
        { name: '交互与动效', level: 74 }
      ]
    },
    {
      group: '后端',
      icon: 'cpu',
      items: [
        { name: 'Python', level: 78 },
        { name: 'aiohttp / Flask', level: 68 },
        { name: '接口与数据建模', level: 66 }
      ]
    },
    {
      group: '系统与硬件',
      icon: 'terminal',
      items: [
        { name: 'Linux / Debian', level: 76 },
        { name: '树莓派 / GPIO', level: 82 },
        { name: 'systemd / 部署', level: 70 }
      ]
    },
    {
      group: '网络',
      icon: 'globe',
      items: [
        { name: '内网穿透 / FRP', level: 64 },
        { name: 'DNS / HTTPS', level: 60 },
        { name: 'SSH / 隧道', level: 72 }
      ]
    }
  ],

  /* ---------- 联系页文案 ---------- */
  contact: {
    title: '来聊点什么吧',
    desc: '不管是项目合作、技术问题，还是想吐槽这个仿 Windows 的界面，都欢迎给我发消息。通常我会在一天内回复。',
    topics: [
      { icon: 'code',   title: '技术交流', desc: '前端、树莓派、自建服务都可以聊' },
      { icon: 'sparkle', title: '一起做点东西', desc: '有想法但缺人手？可以找我试试' },
      { icon: 'mail',   title: '只是打个招呼', desc: '也完全没问题，邮件我都会看' }
    ],
    formNote: '下面的表单会把内容整理成一封邮件，通过你本机的邮件客户端发送。'
  },

  /* ---------- 壁纸列表（设置里可切换） ---------- */
  wallpapers: [
    { id: 'chenyu', name: '沉玉 · 山水之间', thumb: 'assets/img/thumb-chenyu.webp', src: 'assets/img/wall-chenyu.webp', dark: false },
    { id: 'bloom',  name: 'Bloom 蓝',   thumb: 'assets/img/thumb-bloom.jpg',  dark: false },
    { id: 'dusk',   name: 'Dusk 暮色',  thumb: 'assets/img/thumb-dusk.jpg',   dark: true },
    { id: 'aurora', name: 'Aurora 极光', thumb: 'assets/img/thumb-aurora.jpg', dark: true },
    { id: 'sakura', name: 'Sakura 樱',  thumb: 'assets/img/thumb-sakura.jpg', dark: false },
    { id: 'solid',  name: '午夜纯色',   thumb: '', dark: true }
  ],

  /* ---------- 桌面图标（按顺序排两列） ---------- */
  desktop: ['thispc', 'projects', 'frost-atlas', 'liyun-explorer', 'genshin-start', 'genshin-original', 'voxel-campus', 'rpi-task-manager', 'about', 'skills', 'contact', 'cv', 'notepad', 'terminal', 'settings', 'recycle'],

  /* ---------- 任务栏固定项 ---------- */
  taskbarPinned: ['thispc', 'projects', 'about', 'terminal', 'settings'],

  /* ---------- 开始菜单固定项 ---------- */
  startPinned: ['about', 'projects', 'frost-atlas', 'liyun-explorer', 'genshin-start', 'genshin-original', 'voxel-campus', 'rpi-task-manager', 'skills', 'contact', 'thispc', 'terminal', 'settings', 'notepad', 'photos', 'cv', 'recycle'],

  /* ---------- 开始菜单「推荐的项目」 ---------- */
  recommended: [
    { icon: 'about',   title: '关于我',      sub: '认识一下这个家伙', app: 'about' },
    { icon: 'projects', title: '项目作品',   sub: '最近在折腾的几件事', app: 'projects' },
    { icon: 'terminal', title: '打开终端',   sub: '敲 help 看看能干嘛', app: 'terminal' },
    { icon: 'notepad',  title: '写给访客',   sub: '一段碎碎念',        app: 'notepad' }
  ],

  /* ---------- 通知中心初始消息 ---------- */
  notifications: [
    {
      icon: 'about',
      title: '欢迎来到我的主页',
      body: '双击图标打开窗口，手机轻点即可。点击任务栏的开始图标，或按 Alt + Shift + S，看看案头都放了些什么。',
      time: '刚刚'
    },
    {
      icon: 'globe',
      title: '站点已上线',
      body: 'studentop.cn · 由树莓派 4B 提供，nginx + HTTPS + 内网穿透。',
      time: '刚刚'
    },
    {
      icon: 'settings',
      title: '小提示',
      body: '在「设置」里可以换壁纸、深色模式和主题色。',
      time: '刚刚'
    }
  ],

  /* ---------- 终端里的虚拟文件（cat 可读） ---------- */
  terminalFiles: {
    'readme.txt': '这是 Aiden 的个人主页。\n它长得像 Windows 11，但其实是一张网页。\n输入 help 看看能做什么。',
    'contact.txt': 'email : aiden@studentop.cn\ngithub: @AnonymousUser443',
    'todo.txt': '- 把相册页填满\n- 把新想法慢慢做出来\n- 早点睡'
  },

  /* ---------- 页脚 / 版权 ---------- */
  footer: '用 HTML / CSS / JavaScript 手写 · 无框架 · 无 CDN · 无追踪'
};
