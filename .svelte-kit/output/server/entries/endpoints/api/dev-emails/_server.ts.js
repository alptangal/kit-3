import { json } from "@sveltejs/kit";
const GET = async () => {
  return json({ emails: [] }, { status: 404 });
};
export {
  GET
};
