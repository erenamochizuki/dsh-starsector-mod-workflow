package sscore;

/** 列表滚动与选择：只管状态，不画、不读输入。 */
public final class ListView {
    private int rowCount;
    private int visibleRows;
    private int scroll;
    private int selected = -1;

    public ListView(int rowCount, int visibleRows) {
        if (visibleRows <= 0) throw new IllegalArgumentException("visibleRows <= 0");
        this.visibleRows = visibleRows;
        setRowCount(rowCount);
    }

    public int rowCount() {
        return rowCount;
    }

    public int visibleRows() {
        return visibleRows;
    }

    public int scroll() {
        return scroll;
    }

    public int selected() {
        return selected;
    }

    public int maxScroll() {
        return Math.max(0, rowCount - visibleRows);
    }

    /** 行数变少时把滚动位置夹回合法范围。 */
    public void setRowCount(int n) {
        this.rowCount = Math.max(0, n);
        scroll = Math.min(scroll, maxScroll());
        if (selected >= rowCount) selected = rowCount - 1;
    }

    public void setVisibleRows(int n) {
        if (n <= 0) throw new IllegalArgumentException("visibleRows <= 0");
        visibleRows = n;
        scroll = Math.min(scroll, maxScroll());
    }

    public int scrollBy(int delta) {
        int before = scroll;
        scroll = Math.max(0, Math.min(maxScroll(), scroll + delta));
        return scroll - before;
    }

    public void pageUp() {
        scrollBy(-visibleRows);
    }

    public void pageDown() {
        scrollBy(visibleRows);
    }

    /** 选中一行，并保证它在可视区内。 */
    public void select(int index) {
        if (rowCount == 0) {
            selected = -1;
            return;
        }
        selected = Math.max(0, Math.min(rowCount - 1, index));
        if (selected < scroll) scroll = selected;
        if (selected >= scroll + visibleRows) scroll = selected - visibleRows + 1;
    }

    public void selectNext() {
        select(selected < 0 ? 0 : selected + 1);
    }

    public void selectPrev() {
        select(selected < 0 ? 0 : selected - 1);
    }

    /** 视口内相对 y → 行号；落在空白处返回 -1。 */
    public int rowAt(float y, float rowHeight) {
        if (rowHeight <= 0f) return -1;
        int i = (int) Math.floor(y / rowHeight);
        if (i < 0 || i >= visibleRows) return -1;
        int row = scroll + i;
        return row < rowCount ? row : -1;
    }

    public float scrollFraction() {
        return maxScroll() == 0 ? 0f : (float) scroll / maxScroll();
    }
}
