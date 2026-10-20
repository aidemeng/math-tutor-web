import { expect, it } from "vitest";
import { createTeacherStore } from "../src/store/teacherStore";
import type { TutorClient } from "../src/api/client";

it("restores the same complete reply and cards that were shown during streaming", async () => {
  const supplement = "这里是课堂上可以追问学生的思路和易错点。".repeat(30);
  const events = [
    { type: "text", text: "先读取题目。" },
    {
      type: "question",
      question: {
        id: "gen_1",
        bankVersion: "v1",
        kind: "solution",
        stem: "x+1=3",
        explanation: "移项求解。",
        answer: "x=2",
      },
    },
    { type: "text_reset", text: "解析已完成。" },
    { type: "text", text: supplement },
    { type: "done" },
  ];
  const store = createTeacherStore({
    client: {
      sendMessage: (
        _id: string,
        _input: unknown,
        emit: (event: any) => void,
      ) => {
        events.forEach(emit);
        return { done: Promise.resolve(), cancel() {} };
      },
      getConversation: async () => ({
        messages: [
          { role: "user", content: "讲讲这道题" },
          {
            role: "assistant",
            content: events.map((event) => JSON.stringify(event)).join("\n"),
          },
        ],
      }),
    } as unknown as TutorClient,
  });
  store.state.activeId = "conversation";
  await store.send("讲讲这道题");
  const live = store.state.turns[0];
  await store.openConversation("conversation");
  expect(store.state.turns[0].reply).toBe(live.reply);
  expect(store.state.turns[0].reply).toContain(supplement);
  expect(store.state.turns[0].questions).toEqual(live.questions);
});

it("replaces revised solutions for the same photo in saved history", async () => {
  const first = {id:'gen_old',bankVersion:'teacher-input',kind:'solution',photoId:'photo',stem:'原题',answer:'旧答案',explanation:'旧解析'};
  const latest = {...first,id:'gen_new',answer:'修正答案'};
  const store = createTeacherStore({client:{getConversation:async () => ({messages:[
    {role:'user',content:'解题'},
    {role:'assistant',content:[first,latest].map(question => JSON.stringify({type:'question',question})).join('\n')}
  ]})} as unknown as TutorClient});
  await store.openConversation('conversation');
  expect(store.state.turns[0].questions).toEqual([latest]);
});
