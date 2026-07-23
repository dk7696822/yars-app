"use strict";

const db = require("../src/models");
const {
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
} = require("../src/controllers/assistantController");

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("assistant conversations CRUD", () => {
  test("create → list → get → delete lifecycle", async () => {
    // create
    let res = mockRes();
    await createConversation({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const conv = res.json.mock.calls[0][0].data;

    // add a message directly, then get
    await db.AssistantMessage.create({ conversation_id: conv.id, role: "user", content: "hello" });
    res = mockRes();
    await getConversation({ params: { id: conv.id } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.messages).toHaveLength(1);

    // list excludes nothing yet
    res = mockRes();
    await listConversations({ query: {} }, res);
    expect(res.json.mock.calls[0][0].data.data).toHaveLength(1);

    // delete = archive
    res = mockRes();
    await deleteConversation({ params: { id: conv.id } }, res);
    expect(res.status).toHaveBeenCalledWith(200);

    // list now empty
    res = mockRes();
    await listConversations({ query: {} }, res);
    expect(res.json.mock.calls[0][0].data.data).toHaveLength(0);
  });

  test("get unknown id → 404", async () => {
    const res = mockRes();
    await getConversation({ params: { id: "11111111-1111-4111-8111-111111111111" } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
