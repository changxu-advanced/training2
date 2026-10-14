import ja from "element-plus/es/locale/lang/ja.mjs";

// Complete labels still left in English by the upstream Japanese locale.
export const japaneseLocale = {
  ...ja,
  el: {
    ...ja.el,
    inputNumber: {
      ...ja.el.inputNumber,
      decrease: "値を減らす",
      increase: "値を増やす",
    },
    pagination: {
      ...ja.el.pagination,
      page: "ページ",
      prev: "前のページへ",
      next: "次のページへ",
      currentPage: "{pager}ページ目",
      prevPages: "前の{pager}ページへ",
      nextPages: "次の{pager}ページへ",
    },
    dialog: { ...ja.el.dialog, close: "閉じる" },
    messagebox: { ...ja.el.messagebox, confirm: "確認", close: "閉じる" },
  },
};
