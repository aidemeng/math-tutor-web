import { expect, it } from "vitest";
import { mergeSelectionRects } from "../src/lib/selectionPaint";

it("paints a formula's glyph fragments as one continuous line", () => {
  expect(mergeSelectionRects([{left:10,top:20,width:20,height:18}, {left:32,top:20,width:18,height:18}]))
    .toEqual([{left:10,top:20,width:40,height:18}]);
});
it("keeps different lines separate and includes taller formula parts", () => {
  expect(mergeSelectionRects([{left:10,top:20,width:20,height:24}, {left:30,top:24,width:25,height:16},
    {left:10,top:52,width:40,height:18}]))
    .toEqual([{left:10,top:20,width:45,height:24}, {left:10,top:52,width:40,height:18}]);
});
