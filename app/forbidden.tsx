export default function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1a1a]">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white">403</h1>
        <p className="mt-2 text-gray-400">
          You don&apos;t have permission to access this page.
        </p>
      </div>
    </div>
  );
}
