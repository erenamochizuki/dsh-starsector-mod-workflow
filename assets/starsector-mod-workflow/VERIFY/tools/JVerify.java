// VERIFY\tools\JVerify.java：用游戏自带 janino 编译 mod 源码（与实机同源）
// 为什么不用 janino CLI：2.7.8 的 CLI 在 Java 17 上按 rt.jar/ext.dirs 找类，
// 这些属性 Java 9+ 已移除，会 NPE。这里直接调 API，父加载器指向游戏 jar。
// 用法：java -cp "tools;<游戏 jar 分号分隔>" JVerify <classpath> <outDir> <源码根> <@列表|文件...>
// 输出：`<文件>:<行>: <消息>` 若干行，末尾 `__JV_ERRORS__ <n>`；0 无错 / 1 有错。
import org.codehaus.commons.compiler.ErrorHandler;
import org.codehaus.commons.compiler.Location;
import org.codehaus.janino.ClassLoaderIClassLoader;
import org.codehaus.janino.Compiler;
import org.codehaus.janino.IClassLoader;
import org.codehaus.janino.util.resource.DirectoryResourceCreator;
import org.codehaus.janino.util.resource.PathResourceFinder;
import org.codehaus.janino.util.resource.ResourceFinder;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.ArrayList;
import java.util.List;

public class JVerify {
    public static void main(String[] args) throws Exception {
        String cp = args[0];
        File outDir = new File(args[1]);
        // 源码根可以有多个（mod 的 data\scripts 与积木目录），分号分隔
        java.util.List<File> roots = new ArrayList<File>();
        for (String r : args[2].split(";")) {
            if (r.trim().length() > 0) roots.add(new File(r.trim()));
        }
        outDir.mkdirs();

        // 父加载器：输出目录 + 游戏 jar，让 janino 能解析 com.fs.* 与 org.lwjgl.*
        List<URL> urls = new ArrayList<URL>();
        urls.add(outDir.toURI().toURL());
        for (String p : cp.split(";")) {
            if (p.trim().length() > 0) urls.add(new File(p.trim()).toURI().toURL());
        }
        ClassLoader parent = new URLClassLoader(urls.toArray(new URL[urls.size()]), JVerify.class.getClassLoader());

        // 待编译文件：@列表 或 直接枚举
        List<File> files = new ArrayList<File>();
        if (args[3].startsWith("@")) {
            BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(args[3].substring(1)), "UTF-8"));
            try {
                String line;
                while ((line = r.readLine()) != null) {
                    line = line.trim();
                    if (line.length() > 0) files.add(new File(line));
                }
            } finally {
                r.close();
            }
        } else {
            for (int i = 3; i < args.length; i++) files.add(new File(args[i]));
        }

        // 源码根用于定位 import 对应的 .java，输出写 outDir
        ResourceFinder srcFinder = new PathResourceFinder(roots.toArray(new File[roots.size()]));
        IClassLoader icl = new ClassLoaderIClassLoader(parent);
        Compiler c = new Compiler(srcFinder, icl, srcFinder, new DirectoryResourceCreator(outDir),
                "UTF-8", false, true, true, false, null);

        // 收集全部错误，不在第一条就中断
        final List<String> errs = new ArrayList<String>();
        c.setCompileErrorHandler(new ErrorHandler() {
            public void handleError(String msg, Location loc) {
                String where = loc == null ? "" : (loc.getFileName() + ":" + loc.getLineNumber() + ": ");
                errs.add(where + msg);
            }
        });

        try {
            c.compile(files.toArray(new File[files.size()]));
        } catch (Throwable t) {
            // 处理器已收集到具体错误时，不再重复记一条汇总异常
            if (errs.isEmpty()) errs.add("编译驱动异常: " + t);
        }

        for (String e : errs) System.out.println(e);
        System.out.println("__JV_ERRORS__ " + errs.size());
        System.exit(errs.isEmpty() ? 0 : 1);
    }
}
