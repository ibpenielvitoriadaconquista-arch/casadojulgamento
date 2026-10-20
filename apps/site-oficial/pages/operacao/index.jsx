// Entry point for the staff area. Keep a single official sign-in route.
export async function getServerSideProps() {
  return {redirect:{destination:'/operacao/login',permanent:false}};
}
export default function OperacaoIndex() { return null; }
