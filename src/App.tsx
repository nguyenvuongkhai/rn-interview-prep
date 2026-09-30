import { content } from './content';

export function App() {
  return (
    <main>
      <h1>RN Interview Prep</h1>
      <p>
        {content.topics.length} topics · {content.items.length} items · {content.lessons.length} lessons
      </p>
    </main>
  );
}
