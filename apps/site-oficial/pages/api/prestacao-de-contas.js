import {query} from '../../lib/db';
import accountability from '../../lib/accountability-page.cjs';

// The password-protected HTML is stored privately, outside the public repository.
export default accountability.createHandler({query});
