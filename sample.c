int compute_data() {
    int unused_var = 999;
    int a = 10 * 5 + (20 / 4);
    int b = 100 * 2;
    int x = a + b;
    int y = a + b;
    if (0) {
        x = x + 1000;
        y = y * 2;
    }
    int result = 0;
    for (int i = 0; i < 10; i = i + 1) {
        result = result + (x * y) + i;
    }
    return result;
}
